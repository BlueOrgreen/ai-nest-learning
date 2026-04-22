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
 * AllExceptionsFilter（共享版）— 统一异常响应格式
 *
 * 来自 libs/common，供各下游服务（user-service、order-service）全局注册。
 *
 * 捕获所有未处理异常，统一返回格式：
 *   { code: number, message: string, data: null }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

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

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const rawMessage = (body as Record<string, unknown>).message;
        message = Array.isArray(rawMessage)
          ? String(rawMessage[0])
          : String(rawMessage ?? message);
      }
    }

    message = this.friendlyMap[status] ?? message;

    const requestId = (req.headers['x-request-id'] as string) ?? '-';
    const logMsg = `[${requestId}] ${req.method} ${req.originalUrl} → ${status} ${message}`;
    if (status >= 500) {
      this.logger.error(logMsg, exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(logMsg);
    }

    res.status(status).json({ code: status, message, data: null });
  }
}
