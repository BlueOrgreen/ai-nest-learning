import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * LoggerMiddleware — 请求进入日志
 *
 * 职责（Step 7 日志分工 — 方案 A）：
 *   只记录"请求进入"时的元信息，不等待响应完成。
 *
 *   响应完成后的日志（handler 名、耗时、状态码）由 LoggingInterceptor 负责。
 *   两者分工互补，避免重复记录。
 *
 * 记录字段：
 *   - requestId   请求唯一 ID（依赖 RequestIdMiddleware 先注入）
 *   - method      HTTP 方法（GET / POST / ...）
 *   - url         完整请求路径（含 query string）
 *   - ip          客户端 IP
 *   - userAgent   客户端标识
 *
 * 注册顺序：必须在 RequestIdMiddleware 之后注册，
 *            这样才能读到 req.headers['x-request-id']。
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const userAgent = req.headers['user-agent'] ?? '-';
    const requestId = (req.headers['x-request-id'] as string) ?? '-';

    // 请求进入时打印一条日志，后续由 LoggingInterceptor 打印完成日志
    this.logger.log(`【请求Request】[${requestId}] → ${method} ${originalUrl}  ${ip}  "${userAgent}"`);

    next();
  }
}
