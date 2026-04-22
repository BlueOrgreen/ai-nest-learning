# NestJS 中间件学习文档

**日期：** 2026-04-22  
**目标：** 系统学习 NestJS 中间件，从概念到实战，结合网关项目理解适用场景。

---

## 一、中间件在请求管道中的位置 🗺️

NestJS 的完整请求管道按执行顺序如下：

```
客户端请求
    │
    ▼
┌──────────────────────────────────┐
│  Middleware（中间件）             │  ← 最早执行，路由匹配前
│  - 可读写 req / res              │
│  - 调用 next() 放行              │
│  - 不能访问路由元数据             │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  Guard（守卫）                   │  ← 鉴权 / 权限控制
│  - 可读取 @Roles() 等元数据      │
│  - 返回 true/false 决定放行      │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  Interceptor（拦截器）before     │  ← 进入 Controller 前
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  Pipe（管道）                    │  ← 参数验证 / 转换
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  Controller / Handler            │  ← 业务逻辑
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  Interceptor（拦截器）after      │  ← 返回响应前
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  ExceptionFilter（异常过滤器）   │  ← 捕获抛出的异常
└──────────────────────────────────┘
    │
    ▼
客户端响应
```

### 中间件 vs Guard vs Interceptor 选型对比

| 维度 | Middleware | Guard | Interceptor |
|------|-----------|-------|------------|
| 执行时机 | 最早（路由匹配前） | Guard 之前 → 中间件之后 | Guard 之后 |
| 能访问路由元数据？ | ❌ 不能 | ✅ 能（Reflector） | ✅ 能 |
| 能访问 NestJS DI？ | ✅ 类中间件可以 | ✅ | ✅ |
| 能修改响应体？ | ⚠️ 直接操作 res | ❌ | ✅ |
| Express 中间件兼容？ | ✅ 直接复用 | ❌ | ❌ |
| 典型场景 | 日志、request-id、CORS、body 解析 | JWT 验证、角色权限 | 响应格式统一、耗时统计 |

> 💡 **一句话选型原则**：需要复用 Express 生态 / 最早介入请求 → 用 Middleware；需要读路由元数据决定放不放行 → 用 Guard；需要包裹 Controller 前后逻辑 → 用 Interceptor。

---

## 二、函数式中间件 vs 类中间件 🔧

### 2.1 函数式中间件（Functional Middleware）

Express 风格，最简单，**无法注入依赖**：

```ts
// logger.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function loggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next(); // ⚠️ 必须调用 next()，否则请求卡住
}
```

**适用场景**：逻辑简单、不需要注入 Service 的中间件（如打印日志、添加固定 Header）。

---

### 2.2 类中间件（Class Middleware）

加 `@Injectable()` 装饰器，实现 `NestMiddleware` 接口，**可以注入 Service**：

```ts
// request-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 如果请求没有携带 x-request-id，则自动生成一个
    const requestId = (req.headers['x-request-id'] as string) ?? uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId); // 响应头也带上，方便前端追踪
    next();
  }
}
```

**适用场景**：需要注入 Service（如 `UserService`、`LogService`）的中间件。

---

### 2.3 两种写法对比

```
函数式                          类式
───────────────────────         ────────────────────────────────
export function fn(             @Injectable()
  req, res, next                export class Mw implements NestMiddleware {
) {                               constructor(
  next();                           private readonly svc: SomeService
}                                 ) {}
                                  use(req, res, next) {
                                    next();
                                  }
                                }

✅ 代码少                        ✅ 可注入依赖
❌ 无法注入 Service              ✅ 更符合 NestJS 风格
✅ 和 Express 中间件完全兼容     ❌ 代码稍多
```

---

## 三、注册中间件的方式 📋

### 3.1 模块级注册（推荐）— `configure()` + `MiddlewareConsumer`

在 `AppModule`（或任意 Module）实现 `NestModule` 接口：

```ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RequestIdMiddleware } from './middlewares/request-id.middleware';

@Module({ ... })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)         // 应用哪个中间件
      .forRoutes('*');                    // 对哪些路由生效
  }
}
```

**forRoutes 的几种写法：**

```ts
// 所有路由
.forRoutes('*')

// 特定路径
.forRoutes('api/users')

// 特定路径 + 特定方法
.forRoutes({ path: 'auth/login', method: RequestMethod.POST })

// 某个 Controller 下的所有路由
.forRoutes(AuthController)

// 排除某些路由（先 apply 再 exclude）
.apply(LoggerMiddleware)
.exclude({ path: 'health', method: RequestMethod.GET })
.forRoutes('*')
```

**同时应用多个中间件（按顺序执行）：**

```ts
consumer
  .apply(RequestIdMiddleware, LoggerMiddleware) // 先 RequestId，后 Logger
  .forRoutes('*');
```

---

### 3.2 全局注册 — `app.use()`

在 `main.ts` 里使用，**只能用函数式中间件或 Express 中间件包**：

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 直接复用 Express 中间件包
  app.use(cors({ origin: 'http://localhost:3000' }));

  await app.listen(3010);
}
```

> ⚠️ **`app.use()` vs `forRoutes('*')` 的差异**：
> - `app.use()` 在 NestJS 请求管道**之外**执行，比 `configure()` 更早
> - `app.use()` 无法使用类中间件（不在 DI 容器里）
> - 一般只用 `app.use()` 接入第三方 Express 中间件（如 `cors`、`helmet`、`morgan`）

---

## 四、实战场景设计 🚀

### 场景 A：RequestIdMiddleware — 请求链路追踪

**目的**：每个请求注入唯一 ID，便于在日志、响应头、下游服务之间追踪同一请求。

**实现位置**：`apps/gateway/src/middlewares/request-id.middleware.ts`

**核心逻辑**：

```
请求进入
  │
  ├── 有 x-request-id header？
  │     ├── 是 → 复用（来自上游或客户端）
  │     └── 否 → 生成新的 UUID v4
  │
  ├── 写入 req.headers['x-request-id']（后续中间件 / Controller 可读取）
  ├── 写入 res.setHeader('x-request-id', ...)（响应头带回给客户端）
  └── next()
```

**在网关中的价值**：ProxyService 转发请求时，把 `x-request-id` 透传给 user-service / order-service，实现全链路追踪。

**实现步骤**：
1. 安装 `uuid`：`pnpm add uuid && pnpm add -D @types/uuid`
2. 新建 `apps/gateway/src/middlewares/request-id.middleware.ts`
3. 在 `AppModule.configure()` 中注册，`forRoutes('*')`
4. 在 `ProxyService` 的转发逻辑中，透传 `x-request-id` header

---

### 场景 B：LoggerMiddleware — 请求日志

**目的**：记录每次请求的关键信息，用于开发调试和运行监控。

**实现位置**：`apps/gateway/src/middlewares/logger.middleware.ts`

**记录字段设计**：

| 字段 | 说明 | 来源 |
|------|------|------|
| `requestId` | 请求唯一 ID | `req.headers['x-request-id']`（依赖场景 A） |
| `method` | HTTP 方法 | `req.method` |
| `url` | 请求路径 | `req.originalUrl` |
| `ip` | 客户端 IP | `req.ip` |
| `userAgent` | 浏览器/客户端标识 | `req.headers['user-agent']` |
| `statusCode` | 响应状态码 | `res.statusCode`（响应完成后） |
| `duration` | 请求耗时（ms） | 进入时打点，响应完成后计算差值 |

**核心逻辑**：

```ts
use(req, res, next) {
  const startTime = Date.now();

  // 监听响应完成事件，记录耗时和状态码
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`${req.method} ${req.url} ${res.statusCode} +${duration}ms`);
  });

  next();
}
```

> 💡 **为什么用 `res.on('finish')` 而不是直接在 `next()` 后记录？**
> 中间件调用 `next()` 后会继续往下走，Controller 还没执行，`res.statusCode` 也还没确定。`finish` 事件是 Node.js 原生 `http.ServerResponse` 的事件，在响应数据全部发送完成后触发。

**实现步骤**：
1. 新建 `apps/gateway/src/middlewares/logger.middleware.ts`
2. 在 `AppModule.configure()` 中注册，排在 `RequestIdMiddleware` 之后
3. （可选）后续 Step 7 引入结构化日志库（pino/winston）时替换 `console.log`

---

### 场景 C：CORS 中间件

**目的**：允许前端页面跨域访问网关接口（浏览器同源策略限制）。

**两种实现方式对比**：

| 方式 | 代码位置 | 特点 |
|------|---------|------|
| `app.use(cors(...))` | `main.ts` | 最简单，复用 Express `cors` 包 |
| `app.enableCors(...)` | `main.ts` | NestJS 原生 API，推荐 |

**推荐写法（NestJS 原生）**：

```ts
// main.ts
app.enableCors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], // 允许的前端地址
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  credentials: true, // 允许携带 Cookie
});
```

**学习阶段简化版**（全部放行）：

```ts
app.enableCors(); // 允许所有来源（仅开发环境）
```

**实现步骤**：
1. 修改 `apps/gateway/src/main.ts`，在 `listen` 之前调用 `app.enableCors()`
2. 配置合理的 `origin` 白名单

---

### 场景 D：审计日志（独立设计，不在本文档范围）

> 审计日志与请求日志的**核心区别**：
>
> | | 请求日志（场景 B） | 审计日志（独立设计） |
> |--|----------------|-----------------|
> | 记录对象 | 所有 HTTP 请求 | **关键业务操作**（创建/修改/删除） |
> | 关注点 | 技术指标（耗时、状态码） | 业务意图（谁、做了什么、对什么） |
> | 存储 | 控制台 / 日志文件 | 数据库（持久化，可查询） |
> | 实现层 | 中间件（最合适） | 中间件 or Interceptor（需要 JWT 解码后的用户信息） |
>
> 审计日志需要 `req.user`（JWT 解码后的用户信息），而中间件在 Guard 之前执行，此时 `req.user` 还没被写入。因此审计日志更适合用 **Interceptor** 实现（在 Guard 之后），单独出一份设计文档。

---

## 五、完整注册顺序设计 📐

在 `AppModule` 中，所有中间件按以下顺序注册：

```ts
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(
      RequestIdMiddleware,  // ① 最先：注入 x-request-id（后续中间件都能读到）
      LoggerMiddleware,     // ② 其次：记录日志（能读到 requestId）
    )
    .forRoutes('*');
}
```

加上 `main.ts` 里的：
```ts
app.enableCors();  // 在所有中间件之前，处理 OPTIONS 预检请求
```

完整请求流程：

```
客户端请求
    │
    ▼  main.ts
① CORS（enableCors）          ← OPTIONS 预检在这里处理
    │
    ▼  AppModule.configure()
② RequestIdMiddleware          ← 注入 x-request-id
    │
    ▼
③ LoggerMiddleware             ← 记录请求日志
    │
    ▼  APP_GUARD
④ ThrottlerGuard               ← 限流
    │
    ▼
⑤ JwtAuthGuard                 ← JWT 验证
    │
    ▼
⑥ RolesGuard                   ← 角色鉴权
    │
    ▼
⑦ Controller / ProxyService    ← 业务逻辑 / 转发
```

---

## 六、实现步骤汇总 📝

> **说明**：以下步骤在你确认执行后逐步实施，不会提前改动项目代码。

| # | 任务 | 涉及文件 | 依赖 |
|---|------|---------|------|
| 1 | 安装 `uuid` 依赖 | `package.json` | — |
| 2 | 新建 `RequestIdMiddleware` | `middlewares/request-id.middleware.ts` | uuid |
| 3 | 新建 `LoggerMiddleware` | `middlewares/logger.middleware.ts` | RequestIdMiddleware（需先注册） |
| 4 | 配置 CORS | `main.ts` | — |
| 5 | 在 `AppModule` 注册中间件 | `app.module.ts` | 步骤 2、3 |
| 6 | `ProxyService` 透传 `x-request-id` | `proxy/proxy.service.ts` | 步骤 2 |

---

## 七、关键知识点总结 🧠

| 知识点　　　　　　　　　　　 | 说明　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| ------------------------------| -----------------------------------------------------------------------------|
| 执行顺序　　　　　　　　　　 | Middleware → Guard → Interceptor → Pipe → Controller　　　　　　　　　　　　|
| 函数式 vs 类式　　　　　　　 | 需要注入 Service 用类式，否则函数式更简洁　　　　　　　　　　　　　　　　　 |
| `next()` 必须调用　　　　　　| 否则请求卡住，不会继续往下走　　　　　　　　　　　　　　　　　　　　　　　　|
| `res.on('finish')`　　　　　 | 获取响应状态码和计算耗时的正确方式　　　　　　　　　　　　　　　　　　　　　|
| `app.use()` vs `configure()` | 前者更早、只能函数式；后者在 DI 容器内、支持类中间件　　　　　　　　　　　　|
| 多中间件顺序　　　　　　　　 | `apply(A, B)` 按参数顺序执行，A 先于 B　　　　　　　　　　　　　　　　　　　|
| 中间件无法读路由元数据　　　 | 这是它与 Guard 的核心区别　　　　　　　　　　　　　　　　　　　　　　　　　 |
| 审计日志用 Interceptor　　　 | 因为需要 `req.user`，而该字段由 JwtAuthGuard 写入，Guard 在 Middleware 之后 |
