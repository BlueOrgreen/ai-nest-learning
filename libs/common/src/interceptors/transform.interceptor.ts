import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * 统一成功响应格式
 *
 * 所有下游服务（user-service、order-service）使用此类型，
 * 保证各服务对外响应结构一致。
 */
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

/**
 * TransformInterceptor（共享版）— 统一成功响应包装
 *
 * 来自 libs/common，供各下游服务（user-service、order-service）全局注册。
 *
 * 将 Controller handler 的返回值包装为统一格式：
 *   { code: 0, data: T, message: "ok" }
 *
 * 注意：
 *   此版本不含 @SkipTransform() 逻辑（下游服务不需要）。
 *   gateway 层有自己带 Reflector 的版本（apps/gateway/src/interceptors/transform.interceptor.ts），
 *   两者分工明确：
 *     - 下游服务（本文件）：无条件包装，所有 handler 返回值都格式化
 *     - gateway（gateway 版本）：通过 @SkipTransform() 跳过 proxy 路由
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data): ApiResponse<T> => ({ code: 0, data, message: 'ok' })),
    );
  }
}
