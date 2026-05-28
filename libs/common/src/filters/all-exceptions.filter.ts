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
 *
 * 400 校验错误：优先返回 ValidationPipe / DTO 上的 message，不覆盖为笼统文案。
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

  /** Nest 默认英文标题，无具体字段信息时不应覆盖 DTO 文案 */
  private readonly genericMessages = new Set([
    'Bad Request',
    'Unauthorized',
    'Forbidden',
    'Not Found',
    'Internal Server Error',
    'Conflict',
    'Unprocessable Entity',
  ]);

  private extractHttpMessage(body: unknown): string | null {
    if (typeof body === 'string') {
      return body;
    }
    if (typeof body === 'object' && body !== null) {
      const raw = (body as Record<string, unknown>).message;
      if (Array.isArray(raw)) {
        const parts = raw.map((m) => String(m)).filter((m) => m.length > 0);
        return parts.length > 0 ? parts.join('; ') : null;
      }
      if (raw != null && String(raw).length > 0) {
        return String(raw);
      }
    }
    return null;
  }

  private isQueryFailedError(exception: unknown): exception is Error {
    return exception instanceof Error && exception.name === 'QueryFailedError';
  }

  private mapQueryFailedMessage(exception: Error): string {
    const msg = exception.message;
    if (msg.includes("column 'reason'")) {
      return `reason 必须是 manual、order、batch_import、correction 之一，自定义说明请写在 remark`;
    }
    if (msg.includes('Data truncated')) {
      return '参数值不符合数据库字段要求，请检查枚举或字段长度';
    }
    return '数据写入失败，请检查请求参数';
  }

  private resolveMessage(status: number, extracted: string | null): string {
    if (extracted && !this.genericMessages.has(extracted)) {
      return extracted;
    }
    return this.friendlyMap[status] ?? extracted ?? this.friendlyMap[500];
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = this.friendlyMap[500];
    let extracted: string | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      extracted = this.extractHttpMessage(exception.getResponse());
      message = this.resolveMessage(status, extracted);
    } else if (this.isQueryFailedError(exception)) {
      status = HttpStatus.BAD_REQUEST;
      message = this.mapQueryFailedMessage(exception);
    }

    const requestId = (req.headers['x-request-id'] as string) ?? '-';
    const logMsg = `[${requestId}] ${req.method} ${req.originalUrl} → ${status} ${message}`;
    if (status >= 500) {
      this.logger.error(
        logMsg,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(logMsg);
    }

    res.status(status).json({ code: status, message, data: null });
  }
}
