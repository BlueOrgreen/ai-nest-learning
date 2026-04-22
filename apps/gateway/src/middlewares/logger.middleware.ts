import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * LoggerMiddleware
 *
 * 作用：记录每次 HTTP 请求的关键信息，用于开发调试和运行监控。
 *
 * 记录字段：
 *   - requestId   请求唯一 ID（依赖 RequestIdMiddleware 先注入）
 *   - method      HTTP 方法（GET / POST / ...）
 *   - url         完整请求路径（含 query string）
 *   - ip          客户端 IP
 *   - userAgent   客户端标识
 *   - statusCode  响应状态码
 *   - duration    请求耗时（ms）
 *
 * 注意：statusCode 和 duration 需要等响应完成后才能拿到，
 *       因此监听 res 的 'finish' 事件而不是在 next() 后直接记录。
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
    const startTime = Date.now();

    // 'finish' 事件：Node.js 原生事件，响应数据全部发送完毕后触发
    // 此时 res.statusCode 已确定，可以计算耗时
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // 根据状态码选择日志级别，便于快速定位问题
      const logMsg =
        `[${requestId}] ${method} ${originalUrl} ` +
        `${statusCode} +${duration}ms — ${ip} "${userAgent}"`;

      if (statusCode >= 500) {
        this.logger.error(logMsg);
      } else if (statusCode >= 400) {
        this.logger.warn(logMsg);
      } else {
        this.logger.log(logMsg);
      }
    });

    next();
  }
}
