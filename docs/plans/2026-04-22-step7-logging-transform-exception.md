# Step 7：统一日志、响应、异常处理

> 基于 `docs/plans/2026-04-16-gateway-design.md` Step 7 章节  
> 日期：2026-04-22  
> 涉及服务：`apps/gateway`

---

## 一、目标

在 Gateway 层统一处理三件事：

| # | 目标 | 实现方式 |
|---|------|---------|
| 1 | 请求日志分层记录 | `LoggerMiddleware`（改造）+ `LoggingInterceptor`（新增） |
| 2 | 统一成功响应格式 | `TransformInterceptor` + `@SkipTransform()` 装饰器 |
| 3 | 统一异常响应格式 | `AllExceptionsFilter` |

---

## 二、架构决策

### 2.1 日志分工（方案 A：分层互补）

**背景**：已有 `LoggerMiddleware` 记录完整 HTTP 日志（含耗时、状态码）。若新增 `LoggingInterceptor` 不加区分，会产生重复日志。

**决策**：裁剪 `LoggerMiddleware`，只保留"请求进入"日志；`LoggingInterceptor` 负责"请求完成"日志。

```
请求进入 → LoggerMiddleware 打印 [requestId] → POST /auth/login (127.0.0.1)
              ↓
         Controller 处理
              ↓
请求完成 → LoggingInterceptor 打印 [requestId] AuthController#login → 200 +12ms
```

| 层 | 时机 | 记录内容 |
|----|------|---------|
| `LoggerMiddleware` | 请求刚进入 | method、url、ip、userAgent、requestId |
| `LoggingInterceptor` | Controller 返回后 | handler 名称、响应状态码、耗时 |

**注意**：proxy 路由使用 `@Res()` 直接操控响应流，脱离 NestJS 响应生命周期，`LoggingInterceptor` 的 `next.handle()` 对这些路由不会触发完成回调——这是预期行为，`LoggerMiddleware` 已经覆盖了它们的日志。

### 2.2 统一响应格式（方案 C：@SkipTransform 完整实现）

**背景**：`TransformInterceptor` 全局注册后，proxy 路由会面临"双重包装"问题——下游服务已返回 JSON，再包一层会破坏结构。

**决策**：实现 `@SkipTransform()` 元数据装饰器，`TransformInterceptor` 通过 `Reflector` 读取该元数据，对标注路由直接透传。

```
GET  /auth/login   → 无 @SkipTransform → 包装 → { code: 0, data: {...}, message: "ok" }
GET  /api/orders   → 有 @SkipTransform → 透传 → 下游原始 JSON
```

**为什么不依赖 `@Res()` 的天然跳过？**

`@Res()` 让响应脱离 NestJS 管道，`TransformInterceptor` 确实拿不到返回值，但这是**隐式行为**。`@SkipTransform()` 是**显式声明**，代码意图清晰，且未来即使路由实现方式改变，语义依然保留。这也是学习 `Reflector` + 自定义元数据的完整示例。

### 2.3 统一异常格式（直接做）

所有未捕获异常统一返回：

```json
{ "code": 401, "message": "请先登录，或 Token 已过期", "data": null }
```

`Guard`（ThrottlerGuard、JwtAuthGuard、RolesGuard）抛出的异常在响应流被 `@Res()` 接管之前，ExceptionFilter 可以正常捕获并格式化。

---

## 三、文件清单

```
apps/gateway/src/
├── middlewares/
│   └── logger.middleware.ts          # 改造：只保留 request in 日志
├── interceptors/                     # 新建目录
│   ├── logging.interceptor.ts        # 新增：记录 handler 名称、耗时、状态码
│   └── transform.interceptor.ts      # 新增：统一成功响应格式
├── decorators/                       # 新建目录
│   └── skip-transform.decorator.ts   # 新增：@SkipTransform() 元数据标记
├── filters/                          # 新建目录
│   └── all-exceptions.filter.ts      # 新增：统一异常响应格式
├── proxy/
│   └── proxy.controller.ts           # 改造：添加 @SkipTransform()
└── main.ts                           # 改造：注册 Filter、Interceptor
```

---

## 四、详细设计

### 4.1 LoggerMiddleware 裁剪

**改造前**（记录完整日志，含耗时和状态码）：
```ts
res.on('finish', () => {
  const duration = Date.now() - startTime;
  // 打印 method url statusCode duration ip userAgent
});
next();
```

**改造后**（只打印 request in）：
```ts
// 只在请求进入时打印一条日志
this.logger.log(`[${requestId}] → ${method} ${url}  ${ip}  "${userAgent}"`);
next();
```

---

### 4.2 LoggingInterceptor

```ts
// interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const requestId = req.headers['x-request-id'] ?? '-';
    const className  = context.getClass().name;
    const handlerName = context.getHandler().name;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - start;
        logger.log(`[${requestId}] ${className}#${handlerName} → ${res.statusCode} +${duration}ms`);
      }),
    );
  }
}
```

**关键点**：`tap` 在 Observable 完成时执行（即 Controller 返回值后），对 `@Res()` 路由不触发（因为 Observable 不会 emit）。

---

### 4.3 @SkipTransform + TransformInterceptor

```ts
// decorators/skip-transform.decorator.ts
export const SKIP_TRANSFORM_KEY = 'skipTransform';
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
```

```ts
// interceptors/transform.interceptor.ts
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    // 读取路由或 Controller 上的 @SkipTransform() 标记
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return next.handle(); // 透传，不包装

    return next.handle().pipe(
      map((data) => ({ code: 0, data, message: 'ok' })),
    );
  }
}
```

**`getAllAndOverride` 的语义**：优先读方法级元数据，找不到再读类级元数据，方法级可以覆盖类级。

---

### 4.4 AllExceptionsFilter

```ts
// filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx  = host.switchToHttp();
    const res  = ctx.getResponse<Response>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误，请稍后再试';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : (body as any).message ?? message;
      // ThrottlerException 的 message 是数组，取第一条
      if (Array.isArray(message)) message = message[0];
    }

    // 友好提示映射
    const friendlyMap: Record<number, string> = {
      401: '请先登录，或 Token 已过期',
      403: '权限不足，无法访问该资源',
      429: '请求过于频繁，请稍后再试',
    };
    message = friendlyMap[status] ?? message;

    res.status(status).json({ code: status, message, data: null });
  }
}
```

---

### 4.5 注册到 main.ts

```ts
// 注册顺序重要：Filter 先于 Interceptor 先于 Pipe（NestJS 内部顺序是反的，但全局注册时按此理解即可）
app.useGlobalFilters(new AllExceptionsFilter());
app.useGlobalInterceptors(
  new LoggingInterceptor(),
  new TransformInterceptor(new Reflector()),
);
```

**注意**：`TransformInterceptor` 依赖 `Reflector`，在 `main.ts` 手动 `new Reflector()` 即可（不需要 DI 容器）。

---

## 五、请求生命周期全览（改造后）

```
HTTP 请求
  │
  ├─ RequestIdMiddleware    注入 x-request-id
  ├─ LoggerMiddleware       打印 "→ POST /auth/login  127.0.0.1"
  │
  ├─ ThrottlerGuard         限流检查（超限 → 抛 ThrottlerException）
  ├─ JwtAuthGuard           JWT 验证（无效 → 抛 UnauthorizedException）
  ├─ RolesGuard             角色检查（不足 → 抛 ForbiddenException）
  │
  ├─ LoggingInterceptor     记录开始时间
  ├─ TransformInterceptor   检查 @SkipTransform 元数据
  │
  ├─ Controller Handler     业务逻辑 / proxyService.forward()
  │
  ├─ TransformInterceptor   包装响应（或透传）
  ├─ LoggingInterceptor     打印 "AuthController#login → 200 +12ms"
  │
HTTP 响应

异常路径：Guard/Handler 抛异常 → AllExceptionsFilter → 统一格式响应
```

---

## 六、验证方式

```bash
# 1. 登录成功 → 应看到包装格式
curl -s -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | jq .
# 期望：{ "code": 0, "data": { "access_token": "..." }, "message": "ok" }

# 2. 未登录访问需鉴权路由 → 应看到统一异常格式
curl -s http://localhost:3010/api/users | jq .
# 期望：{ "code": 401, "message": "请先登录，或 Token 已过期", "data": null }

# 3. 代理路由 → 应透传，不包装
curl -s http://localhost:3010/api/orders | jq .
# 期望：下游原始 JSON，无外层 code/data/message

# 4. 日志验证（查看终端输出）
# 应看到两条日志（每次请求）：
# [req-xxx] → POST /auth/login  ::1  "curl/..."
# [req-xxx] AuthController#login → 200 +12ms
```

---

## 七、Git 提交记录

| 字段 | 内容 |
|------|------|
| **Commit** | `097248e3da8759a0e028a820f95da9b59732e894` |
| **分支** | `main` |
| **时间** | 2026-04-22 23:12:44 +0800 |
| **Message** | `feat(step7): 统一日志、响应格式、异常处理` |

**变更文件（17 files changed, 1213 insertions, 39 deletions）：**

```
新增文件（create mode）：
  apps/gateway/src/decorators/skip-transform.decorator.ts
  apps/gateway/src/filters/all-exceptions.filter.ts
  apps/gateway/src/interceptors/logging.interceptor.ts
  apps/gateway/src/interceptors/transform.interceptor.ts
  docs/notes/2026-04-22-http-code-explained.md
  docs/notes/2026-04-22-logging-interceptor-explained.md
  docs/plans/2026-04-22-step7-logging-transform-exception.md（本文件）
  libs/common/src/filters/all-exceptions.filter.ts
  libs/common/src/index.ts
  libs/common/src/interceptors/transform.interceptor.ts
  libs/common/tsconfig.lib.json

修改文件：
  apps/gateway/src/main.ts
  apps/gateway/src/middlewares/logger.middleware.ts
  apps/gateway/src/proxy/proxy.controller.ts
  apps/order-service/src/main.ts
  apps/user-service/src/main.ts
  nest-cli.json
```
