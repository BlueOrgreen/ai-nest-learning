# LoggingInterceptor 详解：tap 的执行时机与文件解析

> 日期：2026-04-22  
> 文件：`apps/gateway/src/interceptors/logging.interceptor.ts`

---

## 一、问题

下面这段代码中，`tap` 是响应完成时执行的吗？

```ts
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
```

---

## 二、`tap` 的执行时机

**是的，`tap` 是在 Controller handler 返回值（Observable emit）时执行的。**

但要理解准确时机，需要先理解 `next.handle()` 返回的是什么：

```
next.handle()  →  一个 Observable<T>
```

这个 Observable 表示的是 **"Controller handler 的返回值流"**。

```
Controller handler return value
        ↓ emit
   Observable<T>  ← next.handle() 返回的就是这个
        ↓ pipe
      tap(回调)   ← 每次 emit 时执行
```

**`tap` 的执行时机 = Controller handler 执行完毕、返回值被 emit 的那一刻。**

对于普通的 async handler（比如 `login()`），这就是：
1. `await authService.login(dto)` 执行完
2. `return { access_token: "..." }` 被 NestJS 包成 Observable emit
3. **此时 `tap` 回调触发**

---

## 三、为什么这个时机能拿到 `statusCode`？

你可能有疑问：handler 刚 return，响应还没发出去，`res.statusCode` 怎么有值？

关键在于：**NestJS 在调用 handler 之前，已经根据路由配置把 `statusCode` 设好了**（默认 200，`@HttpCode(204)` 等装饰器会提前设置）。

```
NestJS 内部流程：
  1. 解析路由 → 确定默认 statusCode（200）
  2. 执行 Guard
  3. 执行 Interceptor（进入 intercept 方法）
  4. 调用 next.handle() → 执行 handler
  5. handler return → Observable emit → tap 触发
     此时 res.statusCode 已经是 200（或你用 @HttpCode 设置的值）
  6. NestJS 把返回值序列化成 JSON，真正写入响应流
```

所以 `tap` 里拿到的 `statusCode` 是**准确的**，不会是 0 或未定义。

---

## 四、完整文件逐行解析

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
```

- `NestInterceptor`：拦截器接口，必须实现 `intercept()` 方法
- `CallHandler`：代表"后续的处理链"，调用 `.handle()` 才会真正执行 Controller handler
- `ExecutionContext`：执行上下文，可以取出当前的 `req`、`res`、Controller 类、handler 方法
- `tap`：RxJS 副作用操作符，不修改流中的值，只在 emit 时执行额外逻辑

---

```ts
intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
```

`intercept` 是 NestJS 拦截器的核心方法，每次请求进入 Controller 前都会调用它。

- 返回 `Observable<unknown>`：NestJS 最终会订阅这个 Observable，把 emit 的值序列化成 HTTP 响应

---

```ts
const req = context.switchToHttp().getRequest<Request>();
const requestId = (req.headers['x-request-id'] as string) ?? '-';
const className = context.getClass().name;    // 例："AuthController"
const handlerName = context.getHandler().name; // 例："login"
const start = Date.now();  // 记录进入时的时间戳
```

**这段在 `next.handle()` 之前执行**，相当于"请求进入拦截器"时的时机，同步立即执行。

- `context.getClass()` → 返回当前 Controller 的类（`AuthController`）
- `context.getHandler()` → 返回当前要执行的方法（`login` 函数）
- `start = Date.now()` → 记录此刻时间戳，后面用来算耗时

---

```ts
return next.handle().pipe(
  tap(() => { ... })
);
```

**这是拦截器的核心模式：包裹（wrap）模式。**

```
进入拦截器
    ↓
  记录 start（同步，立即执行）
    ↓
next.handle()  ← 放行，让后续 Guard/Pipe/Handler 继续执行
    ↓
  返回 Observable（懒执行，订阅时才真正运行 handler）
    ↓
.pipe(tap(...))  ← 在 Observable 上套一层操作符
    ↓
NestJS 订阅这个 Observable → handler 执行 → emit 值 → tap 回调触发
```

---

```ts
tap(() => {
  const res = context.switchToHttp().getResponse<Response>();
  const duration = Date.now() - start;   // 耗时 = 现在 - 进入时
  const { statusCode } = res;            // NestJS 已设好的状态码
  ...
})
```

`tap` 是 RxJS 的"副作用"操作符，**不修改 Observable 的值，只在 emit 时执行一段额外逻辑**。

对比其他操作符：

| 操作符 | 作用 | 会改变 emit 的值？ |
|--------|------|--------------------|
| `map` | 转换值 | ✅ 会 |
| `tap` | 副作用（日志等） | ❌ 不会 |
| `catchError` | 错误处理 | 取决于实现 |

这里用 `tap` 完全正确，因为日志只是"观测"，不应该修改响应数据。

---

```ts
if (statusCode >= 500) {
  this.logger.error(logMsg);
} else if (statusCode >= 400) {
  this.logger.warn(logMsg);
} else {
  this.logger.log(logMsg);
}
```

根据状态码选择日志级别：

| 状态码范围 | 日志级别 | 含义 |
|-----------|---------|------|
| `500+` | `error`（红色） | 服务器出问题 |
| `400-499` | `warn`（黄色） | 客户端请求有问题 |
| `200-399` | `log`（正常） | 正常响应 |

---

## 五、为什么 proxy 路由的 `tap` 不会触发？

```ts
// proxy.controller.ts
async ordersRoot(@Req() req, @Res() res) {
  await this.proxyService.forward(req, res);
  // 注意：没有 return 值！
}
```

当路由注入了 `@Res()`，NestJS 认为"你自己全权负责响应"，不再管理响应生命周期。

结果是：`next.handle()` 返回的 Observable **永远不会 emit 值**（handler 没有 return），`tap` 回调也就永远不触发。

这正是文件注释里说的"预期行为"—— proxy 路由的日志已由 `LoggerMiddleware` 覆盖。

---

## 六、执行时序全览

```
HTTP 请求到达
    ↓
intercept() 被调用（同步）
    ↓
  记录 start、requestId、className、handlerName
    ↓
调用 next.handle()（放行后续）
    ↓
  handler 异步执行完毕
    ↓
  Observable emit 返回值
    ↓
  tap 回调触发
    → duration = Date.now() - start
    → 读取 res.statusCode
    → 打印日志
    ↓
NestJS 把返回值序列化写入响应流
    ↓
HTTP 响应发出
```

---

## 七、与 `LoggerMiddleware` 的分工

| 层 | 执行时机 | 记录内容 |
|----|---------|---------|
| `LoggerMiddleware` | 请求刚进入，最早 | method、url、ip、userAgent、requestId |
| `LoggingInterceptor` (`tap`) | Controller handler 返回后 | handler 名称、耗时、响应状态码 |

两者合力，每个请求打印两条互补的日志：

```
[req-xxx] → POST /auth/login  ::1  "curl/..."       ← LoggerMiddleware（进入）
[req-xxx] AuthController#login → 200 +12ms           ← LoggingInterceptor（完成）
```
