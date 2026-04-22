# NestJS 网关服务设计文档

**日期：** 2026-04-16  
**项目：** my-firstnest  
**目标：** 学习性网关服务，覆盖微服务网关、BFF、API 网关核心概念

---

## 一、整体架构

### 项目结构（NestJS Monorepo）

```
my-firstnest/
├── apps/
│   ├── gateway/          # 网关服务，端口 3000
│   ├── user-service/     # 用户服务，端口 3001 (HTTP) / 4001 (TCP)
│   └── order-service/    # 订单服务，端口 3002 (HTTP) / 4002 (TCP)
├── libs/
│   └── common/           # 共享类型、DTO、常量
├── docs/
│   └── plans/            # 设计文档
└── package.json
```

### 两阶段学习路径

| 阶段 | 通信方式 | 目标 |
|------|----------|------|
| Phase 1 | HTTP (HttpModule + axios) | 打通全链路，学习网关核心功能 |
| Phase 2 | TCP 微服务 (@nestjs/microservices) | 重构对比，理解两种模式差异 |

---

## 二、核心功能模块

### 网关内部模块划分

```
apps/gateway/src/
├── proxy/            # 路由转发：动态代理到 user/order service
├── auth/             # JWT 签发 & 验证 Guard
├── throttler/        # 限流：@nestjs/throttler
├── interceptors/     # 日志拦截器 + 统一响应格式 + 全局异常过滤器
└── resilience/       # 熔断/重试：opossum + axios-retry
```

### 请求生命周期

```
Client Request
  → RateLimiter       (ThrottlerGuard - 限流)
  → AuthGuard         (JWT 验证 - 鉴权)
  → LoggingInterceptor (记录请求入参、耗时)
  → ProxyService      (路由转发到下游)
      → CircuitBreaker (opossum 熔断保护)
          → user-service / order-service
  → TransformInterceptor (统一响应格式 { code, data, message })
  → Client Response
```

---

## 三、功能模块详细设计

### A. 路由转发（ProxyModule）

- 根据请求路径前缀动态路由：`/users/**` → user-service，`/orders/**` → order-service
- Phase 1：使用 `@nestjs/axios` 的 `HttpService` 转发
- Phase 2：使用 `ClientsModule`（TCP）替换，注册 `ClientProxy`

### B. 身份认证 & 鉴权（AuthModule）

- `POST /auth/login` → 验证用户名密码，签发 JWT（`@nestjs/jwt`）
- `JwtAuthGuard` → 全局守卫，白名单放行 `/auth/login`
- 角色权限：`@Roles()` 装饰器 + `RolesGuard`，支持 `admin` / `user` 两种角色

### C. 限流（ThrottlerModule）

- 全局配置：`ttl: 60s, limit: 100`（每分钟最多 100 次）
- 支持按路由覆盖：敏感接口（如登录）单独收紧为 `limit: 5`

### D. 请求/响应拦截（Interceptors & Filters）

- `LoggingInterceptor`：记录每次请求的方法、路径、耗时、响应状态
- `TransformInterceptor`：统一成功响应格式 `{ code: 0, data: T, message: 'ok' }`
- `AllExceptionsFilter`：捕获所有异常，统一错误响应格式 `{ code: number, message: string }`

### E. 服务熔断 & 重试（ResilienceModule）

- **重试**：`axios-retry`，失败自动重试最多 3 次，指数退避
- **熔断**：`opossum`，连续失败 5 次后开启熔断，30s 后半开探测
- **降级**：熔断开启时返回预设的 fallback 响应，避免雪崩

---

## 四、实现计划

### Phase 1 — HTTP 模式（全链路打通）

| 步骤 | 任务 | 关键知识点 |
|------|------|-----------|
| 1 | 将项目改造为 NestJS Monorepo | `nest g app`、workspace 配置 |
| 2 | 实现 `user-service`（CRUD 接口） | Controller、Service、基础 DTO |
| 3 | 实现 `order-service`（简单订单接口） | 同上 |
| 4 | 网关实现动态路由转发（HTTP） | `HttpModule`、`HttpService`、反向代理 |
| 5 | 实现 JWT 认证 & 角色鉴权 | `@nestjs/jwt`、`PassportModule`、Guards |
| 6 | 实现全局限流 | `@nestjs/throttler`、`ThrottlerGuard` |
| 7 | 实现统一日志、响应、异常处理 | `Interceptor`、`ExceptionFilter` |
| 8 | 实现熔断 & 重试 | `opossum`、`axios-retry` |

### Phase 2 — TCP 微服务（重构对比）

| 步骤 | 任务 | 关键知识点 |
|------|------|-----------|
| 9 | 为下游服务添加 TCP 监听 | `createMicroservice`、`@MessagePattern` |
| 10 | 网关改用 ClientsModule 调用下游 | `ClientProxy`、`send()`、`emit()` |
| 11 | 对比总结两种模式 | 协议差异、性能、适用场景 |

---

## 五、技术选型

| 技术 | 用途 |
|------|------|
| NestJS v11 | 框架 |
| @nestjs/jwt + @nestjs/passport | JWT 认证 |
| @nestjs/throttler | 限流 |
| @nestjs/axios | HTTP 转发（Phase 1） |
| @nestjs/microservices | TCP 通信（Phase 2） |
| opossum | 熔断器 |
| axios-retry | 请求重试 |
| pino / winston | 结构化日志（可选） |

---

## 六、Git 提交规范

每完成设计文档中的一个实现步骤，AI 编码后自动提交一次，便于回溯每个阶段的代码状态。

**Commit message 格式：**

```
feat(step-N): <任务描述>
```

**对应关系：**

| Commit | 描述 | 日期 | Hash |
|--------|------|------|------|
| `feat(step-1)`: 改造为 NestJS Monorepo | 创建 gateway / user-service / order-service | 2026-04-16 | — |
| `feat(step-2)`: 实现 user-service CRUD 接口 | Controller、Service、DTO | 2026-04-16 | — |
| `feat(step-3)`: 实现 order-service 订单接口 | Controller、Service、DTO | 2026-04-16 | — |
| `feat(step-4)`: 网关实现动态路由转发（HTTP） | HttpModule、反向代理 | 2026-04-16 | — |
| `feat(step-5)`: 实现 JWT 认证 & 角色鉴权 | @nestjs/jwt、PassportModule、Guards | 2026-04-16 | — |
| `feat(middleware)`: 实现中间件层 | RequestIdMiddleware、LoggerMiddleware、CORS | 2026-04-22 | `fa4bbdb` |
| `feat(step-6)`: 实现全局限流 | @nestjs/throttler、ThrottlerGuard | — | — |
| `feat(step-7)`: 实现统一日志、响应、异常处理 | Interceptor、ExceptionFilter | — | — |
| `feat(step-8)`: 实现熔断 & 重试 | opossum、axios-retry | — | — |
| `feat(step-9)`: 下游服务添加 TCP 监听 | createMicroservice、@MessagePattern | — | — |
| `feat(step-10)`: 网关改用 ClientsModule（TCP） | ClientProxy、send()、emit() | — | — |
| `feat(step-11)`: 对比总结 HTTP vs TCP 模式 | 补充对比文档 | — | — |

---

## 七、学习目标检验

完成本项目后，应能回答以下问题：

1. 网关如何实现路径匹配和动态转发？
2. JWT 在网关层如何统一验证，下游服务如何信任网关传递的身份信息？
3. 限流的 `ttl` 和 `limit` 如何根据业务场景调整？
4. 熔断器的三种状态（Closed/Open/Half-Open）是如何工作的？
5. HTTP 转发和 TCP 微服务有什么本质区别？各自适合什么场景？
