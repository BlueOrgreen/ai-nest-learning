import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * LoggingInterceptor — 请求完成日志
 *
 * 职责（Step 7 日志分工 — 方案 A）：
 *   在 Controller handler 返回后记录"请求完成"日志，
 *   补充 LoggerMiddleware 拿不到的信息：handler 名称、耗时、响应状态码。
 *
 * 日志格式：
 *   [requestId] ClassName#handlerName → statusCode +Xms
 *   例：[req-abc123] AuthController#login → 200 +12ms
 *
 * 注意：
 *   proxy 路由使用 @Res() 直接操控响应流，脱离 NestJS 响应生命周期，
 *   next.handle() 对这些路由不会 emit 值，tap 回调不会触发。
 *   这是预期行为——proxy 路由的完整日志由 LoggerMiddleware 在中间件层覆盖。
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Handler');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const requestId = (req.headers['x-request-id'] as string) ?? '-';
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - start;
        const { statusCode } = res;

        const logMsg = `【请求完成：Response】[${requestId}] ${className}#${handlerName} → ${statusCode} +${duration}ms`;

        if (statusCode >= 500) {
          this.logger.error(logMsg);
        } else if (statusCode >= 400) {
          this.logger.warn(logMsg);
        } else {
          this.logger.log(logMsg);
        }
      }),
    );
  }
}
