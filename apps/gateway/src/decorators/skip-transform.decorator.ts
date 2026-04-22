import { SetMetadata } from '@nestjs/common';

/**
 * SKIP_TRANSFORM_KEY
 *
 * 元数据 key，用于标识"跳过 TransformInterceptor 包装"。
 * TransformInterceptor 通过 Reflector 读取此 key 来决定是否包装响应。
 */
export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * @SkipTransform()
 *
 * 装饰器：标记某个路由或 Controller 跳过 TransformInterceptor 的响应包装，
 * 直接透传 handler 的返回值（或下游服务的响应）。
 *
 * 使用场景：
 *   - proxy 路由（使用 @Res() 直接操控响应流，下游 JSON 不应被再次包装）
 *   - 需要返回特定格式（如文件流、重定向）的路由
 *
 * 示例：
 *   @SkipTransform()
 *   @All('api/orders')
 *   async ordersRoot(@Req() req, @Res() res) { ... }
 *
 * 原理：
 *   SetMetadata 将 { skipTransform: true } 写入路由的元数据存储，
 *   TransformInterceptor 在 intercept() 阶段通过 Reflector.getAllAndOverride()
 *   读取该标记，若为 true 则直接返回 next.handle()，不执行 map 包装。
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
