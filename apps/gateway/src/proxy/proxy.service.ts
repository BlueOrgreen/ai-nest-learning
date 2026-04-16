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

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly httpService: HttpService,
    @Inject(PROXY_ROUTES_TOKEN) private readonly routes: ProxyRoute[],
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

    this.logger.log(`[PROXY] ${req.method} ${req.path} → ${fullUrl}`);

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: req.method as any,
          url: fullUrl,
          headers,
          data: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
          // 不让 axios 抛出 4xx 错误，交由我们自己处理
          validateStatus: () => true,
        }),
      );

      // 透传下游响应 headers（跳过无法设置的头）
      const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive']);
      Object.entries(response.headers).forEach(([key, value]) => {
        if (!skipHeaders.has(key.toLowerCase()) && value) {
          res.setHeader(key, value as string);
        }
      });

      res.status(response.status).json(response.data);
    } catch (err) {
      const axiosErr = err as AxiosError;
      this.logger.error(
        `[PROXY] Failed to forward to ${fullUrl}: ${axiosErr.message}`,
      );
      throw new BadGatewayException(
        `Upstream service unavailable: ${route.target}`,
      );
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

    return headers;
  }
}
