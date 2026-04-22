import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

/**
 * 统一成功响应格式
 */
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

/**
 * TransformInterceptor — 统一成功响应包装
 *
 * 将 Controller handler 的返回值包装为统一格式：
 *   { code: 0, data: T, message: "ok" }
 *
 * 跳过条件（方案 C — 完整 Reflector 实现）：
 *   路由或 Controller 上标注了 @SkipTransform() 装饰器时，直接透传原始返回值。
 *
 * Reflector.getAllAndOverride 语义：
 *   优先读取 handler（方法）级别的元数据，找不到再读 class（Controller）级别。
 *   方法级可以覆盖类级，实现细粒度控制。
 *
 * 示例：
 *   @SkipTransform()   ← 整个 Controller 跳过包装
 *   @Controller()
 *   export class ProxyController {}
 *
 *   // 或者只对单个方法跳过：
 *   @SkipTransform()
 *   @All('api/orders')
 *   async ordersRoot() {}
 *
 * 注意：
 *   proxy 路由使用 @Res() 接管响应流后，next.handle() 不会 emit 值，
 *   map 回调天然不触发。但 @SkipTransform() 提供了显式的语义声明，
 *   代码意图更清晰，且未来路由实现方式变化时语义依然保留。
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    // 读取 @SkipTransform() 元数据（方法级优先于类级）
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 有 @SkipTransform() 标记 → 直接透传，不包装
    if (skip) return next.handle();

    // 无标记 → 包装为统一格式
    return next.handle().pipe(
      map((data): ApiResponse<T> => ({ code: 0, data, message: 'ok' })),
    );
  }
}
