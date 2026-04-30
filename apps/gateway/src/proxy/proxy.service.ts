
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { ProxyRoute, PROXY_ROUTES_TOKEN } from '../config/proxy-routes.config';
import type { RequestUser } from '../auth/jwt.strategy';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { FallbackService } from '../resilience/fallback.service';
import { CircuitBreakerOpenError } from '../resilience/interfaces/circuit-breaker.interface';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly httpService: HttpService,
    @Inject(PROXY_ROUTES_TOKEN) private readonly routes: ProxyRoute[],
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly fallbackService: FallbackService,
  ) {}

  async forward(req: Request, res: Response): Promise<void> {
    const route = this.matchRoute(req.path);
    if (!route) {
      throw new NotFoundException(`No proxy route found for path: ${req.path}`);
    }

    // 构造目标 URL：去掉 stripPrefix 后拼接到 target
    const downstreamPath = req.path.replace(route.stripPrefix, '');
    const targetUrl = `${route.target}${downstreamPath}`;

    // 透传 query string
    const queryString = new URLSearchParams(
      req.query as Record<string, string>,
    ).toString();
    const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

    // 透传 headers（过滤掉 host，避免下游服务混淆）
    const headers = this.buildForwardHeaders(req);

    this.logger.log(`[PROXY] [Yunfan] ${req.method} ${req.path} → ${fullUrl}`);

    try {
      // 通过熔断器执行请求
      const response = await this.circuitBreakerService.execute(
        route.target, // 使用 target 作为熔断器 key
        () => this.makeRequest(req.method, fullUrl, headers, req.body),
      );

      // 透传下游响应 headers（跳过无法设置的头）
      const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive']);
      Object.entries(response.headers).forEach(([key, value]) => {
        if (!skipHeaders.has(key.toLowerCase()) && value) {
          res.setHeader(key, value as string);
        }
      });

      // 缓存成功的响应（用于降级策略）
      this.fallbackService.cacheResponse(route.target, downstreamPath, response.data);

      res.status(response.status).json(response.data);
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        // 熔断器打开，返回降级响应
        const fallbackResponse = this.fallbackService.getFallbackResponse(
          route.target,
          downstreamPath,
          {
            method: req.method,
            headers: headers as Record<string, string>,
            body: req.body,
          },
        );

        // 设置降级响应头
        Object.entries(fallbackResponse.headers || {}).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        res.status(fallbackResponse.statusCode).json(fallbackResponse.body);
        this.logger.warn(
          `[PROXY] Circuit breaker open for ${route.target}, returning fallback response`,
        );
      } else {
        // 其他错误（网络错误、下游服务错误等）
        const axiosErr = error as AxiosError;
        this.logger.error(
          `[PROXY] Failed to forward to ${fullUrl}: ${axiosErr.message}`,
        );
        throw new BadGatewayException(
          `Upstream service unavailable: ${route.target}`,
        );
      }
    }
  }

  /**
   * 根据请求路径匹配路由规则（最长前缀优先）
   */
  private matchRoute(path: string): ProxyRoute | undefined {
    return [...this.routes]
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find((r) => path.startsWith(r.prefix));
  }

  /**
   * 构造转发 headers：透传原始 headers，去掉 host
   * 同时将网关解析的用户身份注入给下游（x-user-id / x-user-role）
   */
  private buildForwardHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    const skip = new Set(['host', 'content-length']);

    for (const [key, value] of Object.entries(req.headers)) {
      if (!skip.has(key.toLowerCase()) && typeof value === 'string') {
        headers[key] = value;
      }
    }

    // 标记请求来自网关
    headers['x-forwarded-by'] = 'nest-gateway';
    headers['x-forwarded-for'] = req.ip ?? '';

    // 透传请求链路 ID，下游服务日志中可打印此 ID 实现全链路追踪
    const requestId = req.headers['x-request-id'] as string | undefined;
    if (requestId) {
      headers['x-request-id'] = requestId;
    }

    // 注入用户身份，下游可直接读取 headers['x-user-id'] 获取当前用户
    const user = (req as Request & { user?: RequestUser }).user;
    if (user) {
      headers['x-user-id'] = user.userId;
      headers['x-user-role'] = user.role;
      headers['x-user-email'] = user.email;
    }

    return headers;
  }

  /**
   * 执行 HTTP 请求
   */
  private async makeRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: any,
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: method as any,
          url,
          headers,
          data: body && Object.keys(body).length > 0 ? body : undefined,
          // 不让 axios 抛出 4xx 错误，交由我们自己处理
          validateStatus: () => true,
        }),
      );

      return response;
    } catch (error) {
      // 将 AxiosError 抛出，让熔断器记录失败
      throw error;
    }
  }
}
