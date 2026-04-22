import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * AllExceptionsFilter — 统一异常响应格式
 *
 * 捕获所有未处理异常，统一返回格式：
 *   { code: number, message: string, data: null }
 *
 * 处理的异常类型：
 *   - HttpException 子类：ThrottlerException(429)、UnauthorizedException(401)、
 *                          ForbiddenException(403)、NotFoundException(404) 等
 *   - 未知错误（数据库挂了、下游服务挂了等）→ 统一返回 500
 *
 * 友好提示映射：
 *   对常见状态码提供中文提示，覆盖 NestJS 默认的英文 message。
 *
 * 注意：
 *   proxy 路由使用 @Res() 接管响应流，但 Guard（ThrottlerGuard、JwtAuthGuard、
 *   RolesGuard）在 Controller 执行之前抛出异常，此时 @Res() 尚未接管，
 *   ExceptionFilter 可以正常捕获并格式化这些异常。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  // 常见状态码的友好中文提示
  private readonly friendlyMap: Record<number, string> = {
    400: '请求参数有误，请检查后重试',
    401: '请先登录，或 Token 已过期',
    403: '权限不足，无法访问该资源',
    404: '请求的资源不存在',
    429: '请求过于频繁，请稍后再试',
    500: '服务器内部错误，请稍后再试',
    502: '上游服务暂时不可用，请稍后再试',
    503: '服务暂时不可用，请稍后再试',
  };

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = this.friendlyMap[500];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      // NestJS 异常的 response body 可能是 string 或 { message, error, statusCode }
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const rawMessage = (body as Record<string, unknown>).message;
        // ValidationPipe 错误时 message 是数组，取第一条
        message = Array.isArray(rawMessage)
          ? String(rawMessage[0])
          : String(rawMessage ?? message);
      }
    }

    // 用友好提示覆盖，若无映射则保留原始 message
    message = this.friendlyMap[status] ?? message;

    // 记录错误日志（5xx 用 error 级别，4xx 用 warn）
    const requestId = (req.headers['x-request-id'] as string) ?? '-';
    const logMsg = `[${requestId}] ${req.method} ${req.originalUrl} → ${status} ${message}`;
    if (status >= 500) {
      this.logger.error(logMsg, exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(logMsg);
    }

    res.status(status).json({
      code: status,
      message,
      data: null,
    });
  }
}
