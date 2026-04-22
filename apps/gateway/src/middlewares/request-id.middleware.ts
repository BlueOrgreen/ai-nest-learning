import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * RequestIdMiddleware
 *
 * 作用：为每个进入网关的请求注入唯一 ID（x-request-id），
 *       便于在日志、响应头、下游服务之间追踪同一条请求链路。
 *
 * 逻辑：
 *   - 客户端已携带 x-request-id → 复用（方便前端自定义链路 ID）
 *   - 未携带 → 自动生成 UUID v4
 *
 * 写入位置：
 *   - req.headers['x-request-id']  → 后续中间件 / ProxyService 可读取并透传给下游
 *   - res.setHeader(...)            → 响应头带回给客户端，前端可用于问题排查
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingId = req.headers['x-request-id'] as string | undefined;
    const requestId = existingId?.trim() || uuidv4();

    // 写入请求头，供后续中间件和 ProxyService 读取
    req.headers['x-request-id'] = requestId;

    // 写入响应头，客户端收到响应后可以拿到这个 ID 用于问题追踪
    res.setHeader('x-request-id', requestId);

    next();
  }
}
