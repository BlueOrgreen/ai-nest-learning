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

| 步骤 | 任务　　　　　　　　　　　　　　　　 | 关键知识点　　　　　　　　　　　　　　　|
| ------| --------------------------------------| -----------------------------------------|
| 1　　| 将项目改造为 NestJS Monorepo　　　　 | `nest g app`、workspace 配置　　　　　　|
| 2　　| 实现 `user-service`（CRUD 接口）　　 | Controller、Service、基础 DTO　　　　　 |
| 3　　| 实现 `order-service`（简单订单接口） | 同上　　　　　　　　　　　　　　　　　　|
| 4　　| 网关实现动态路由转发（HTTP）　　　　 | `HttpModule`、`HttpService`、反向代理　 |
| 5　　| 实现 JWT 认证 & 角色鉴权　　　　　　 | `@nestjs/jwt`、`PassportModule`、Guards |
| 6　　| 实现全局限流　　　　　　　　　　　　 | `@nestjs/throttler`、`ThrottlerGuard`　 |
| 7　　| 实现统一日志、响应、异常处理　　　　 | `Interceptor`、`ExceptionFilter`　　　　|
| 8　　| 实现熔断 & 重试　　　　　　　　　　　| `opossum`、`axios-retry`　　　　　　　　|

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

| Commit　　　　　　　　　　　　　　　　　　　　 | 描述　　　　　　　　　　　　　　　　　　　　| 日期　　　 | Hash      |
| ------------------------------------------------| ---------------------------------------------| ------------| -----------|
| `feat(step-1)`: 改造为 NestJS Monorepo　　　　 | 创建 gateway / user-service / order-service | 2026-04-16 | —         |
| `feat(step-2)`: 实现 user-service CRUD 接口　　| Controller、Service、DTO　　　　　　　　　　| 2026-04-16 | —         |
| `feat(step-3)`: 实现 order-service 订单接口　　| Controller、Service、DTO　　　　　　　　　　| 2026-04-16 | —         |
| `feat(step-4)`: 网关实现动态路由转发（HTTP）　 | HttpModule、反向代理　　　　　　　　　　　　| 2026-04-16 | —         |
| `feat(step-5)`: 实现 JWT 认证 & 角色鉴权　　　 | @nestjs/jwt、PassportModule、Guards　　　　 | 2026-04-16 | —         |
| `feat(middleware)`: 实现中间件层　　　　　　　 | RequestIdMiddleware、LoggerMiddleware、CORS | 2026-04-22 | `fa4bbdb` |
| `feat(step-6)`: 实现全局限流　　　　　　　　　 | @nestjs/throttler、ThrottlerGuard　　　　　 | —　　　　　| —         |
| `feat(step-7)`: 实现统一日志、响应、异常处理　 | Interceptor、ExceptionFilter　　　　　　　　| —　　　　　| —         |
| `feat(step-8)`: 实现熔断 & 重试　　　　　　　　| opossum、axios-retry　　　　　　　　　　　　| 2026-04-30 | `80ec085` |
| `feat(step-9)`: 下游服务添加 TCP 监听　　　　　| createMicroservice、@MessagePattern　　　　 | —　　　　　| —         |
| `feat(step-10)`: 网关改用 ClientsModule（TCP） | ClientProxy、send()、emit()　　　　　　　　 | —　　　　　| —         |
| `feat(step-11)`: 对比总结 HTTP vs TCP 模式　　 | 补充对比文档　　　　　　　　　　　　　　　　| —　　　　　| —         |

---

## 七、学习目标检验

完成本项目后，应能回答以下问题：

1. 网关如何实现路径匹配和动态转发？

   **回答：**
   - **路径匹配**：网关通过 `ProxyService` 中的 `matchRoute` 方法，依据配置的路由前缀（如 `/users/**`、`/orders/**`）进行匹配。匹配规则定义在 `proxy-routes.config.ts` 中，每个路由包含 `path`（前缀）、`target`（下游服务地址）和 `stripPrefix`（是否剥离前缀）等属性。
   - **动态转发**：
     - **Phase 1（HTTP 模式）**：使用 `@nestjs/axios` 的 `HttpService` 发起 HTTP 请求。匹配到路由后，将原始请求的路径、查询参数、请求头和正文转发到对应的下游服务。
     - **Phase 2（TCP 微服务模式）**：使用 `ClientsModule` 注册 `ClientProxy`，通过 `send()` 或 `emit()` 方法向微服务发送消息，实现基于 TCP 的 RPC 调用。
   - **关键代码位置**：
     - 路由配置：`apps/gateway/src/config/proxy-routes.config.ts`
     - 转发逻辑：`apps/gateway/src/proxy/proxy.service.ts`（`forward` 方法）
     - 模块注册：`apps/gateway/src/proxy/proxy.module.ts`

2. JWT 在网关层如何统一验证，下游服务如何信任网关传递的身份信息？

   **回答：**
   - **网关层验证**：
     1. **登录签发**：`POST /auth/login` 接口校验用户名密码后，使用 `@nestjs/jwt` 签发 JWT。
     2. **全局守卫**：`JwtAuthGuard` 作为全局守卫，对除白名单（如 `/auth/login`）外的所有请求进行 JWT 验证。
     3. **角色鉴权**：配合 `@Roles()` 装饰器和 `RolesGuard`，实现基于角色的访问控制（支持 `admin`/`user` 两种角色）。
   - **身份信息传递与信任**：
     - **传递方式**：网关验证 JWT 后，将解码出的用户信息（如 `userId`、`roles`）注入到请求头（例如 `X-User-Id`、`X-User-Roles`）中，随请求一起转发给下游服务。
     - **下游信任机制**：
       - **简单信任**：下游服务直接读取网关传递的请求头，认为网关已做好验证，不再重复校验。
       - **签名验证**：下游服务也可共享 JWT 密钥，对网关传递的 JWT 进行二次验证（适用于安全要求更高的场景）。
       - **共享上下文**：在 TCP 微服务模式下，可通过自定义序列化器将用户上下文嵌入消息对象。
   - **关键代码位置**：
     - JWT 签发与验证：`apps/gateway/src/auth/`
     - 全局守卫注册：`apps/gateway/src/app.module.ts`
     - 请求头构造：`apps/gateway/src/proxy/proxy.service.ts`（`buildForwardHeaders` 方法）

3. 限流的 `ttl` 和 `limit` 如何根据业务场景调整？

   **回答：**
   - **参数含义**：
     - `ttl`（Time To Live）：时间窗口长度，单位秒。例如 `ttl: 60` 表示统计最近 60 秒内的请求数。
     - `limit`：在 `ttl` 时间窗口内允许的最大请求次数。
   - **调整策略**：
     1. **全局默认**：设计文档中设置 `ttl: 60, limit: 100`（每分钟最多 100 次），适用于大多数普通接口。
     2. **敏感接口收紧**：对于登录、注册、短信发送等易被暴力攻击的接口，可单独配置更严格的限制，例如 `limit: 5`（每分钟最多 5 次），`ttl` 可保持 60 秒或缩短至 30 秒以更快重置计数。
     3. **高并发接口放宽**：对于查询类、静态资源等接口，可适当提高 `limit`（如 500 次/分钟）或延长 `ttl`（如 120 秒），以支持更高的并发量。
     4. **用户级差异化**：结合 `@nestjs/throttler` 的存储器（Storage）可实现基于用户 ID、IP 或角色的差异化限流，例如 VIP 用户享有更高的 `limit`。
   - **配置示例**：
     ```typescript
     // 全局配置（ThrottlerModule.forRoot）
     { ttl: 60, limit: 100 }
     
     // 路由级覆盖（在控制器或方法上使用 @Throttle 装饰器）
     @Throttle({ ttl: 30, limit: 5 })
     ```

4. 熔断器的三种状态（Closed/Open/Half-Open）是如何工作的？

   **回答：**
   - **状态流转**：
     1. **Closed（关闭）**：
        - 初始状态，请求正常通过。
        - 熔断器统计失败次数，当**连续失败次数**达到阈值（文档中为 5 次）时，触发熔断，进入 Open 状态。
     2. **Open（打开）**：
        - 所有请求立即失败，直接返回降级（Fallback）响应，不再调用下游服务。
        - 此状态持续一个设定的“冷却时间”（文档中为 30 秒），之后自动进入 Half-Open 状态。
     3. **Half-Open（半开）**：
        - 允许少量请求（通常为 1 个）通过，作为探测请求。
        - 若探测请求成功，则认为下游服务已恢复，熔断器切换回 Closed 状态。
        - 若探测请求失败，则继续保持 Open 状态，并重新计时冷却时间。
   - **关键配置（文档中示例）**：
     - 连续失败次数阈值：5 次
     - 冷却时间（Open 持续时间）：30 秒
     - 降级策略：返回预设的 Fallback 响应（如缓存数据、默认值或友好提示）
   - **监控与日志**：
     - 熔断器状态变化、失败计数、请求延迟等指标可通过 `/api/resilience/status`、`/health`、`/metrics` 端点实时查看。

5. HTTP 转发和 TCP 微服务有什么本质区别？各自适合什么场景？

   **回答：**
   - **本质区别**：
     | 维度 | HTTP 转发（Phase 1） | TCP 微服务（Phase 2） |
     |------|----------------------|----------------------|
     | **协议层** | 应用层（HTTP/HTTPS） | 传输层（TCP） |
     | **通信模式** | 请求/响应（RESTful、RPC over HTTP） | 消息驱动（RPC、事件） |
     | **数据格式** | JSON、XML、Form‑Data 等（文本） | 二进制（通常使用 JSON、Protobuf 等序列化） |
     | **连接开销** | 每次请求建立/断开连接（HTTP/1.1 可复用） | 长连接，复用同一连接 |
     | **性能** | 相对较高延迟（头部开销大） | 低延迟、高吞吐（二进制、无冗余头部） |
     | **可观测性** | 易于调试（浏览器、curl 可直接访问） | 需要专用工具（如 gRPC 客户端） |
     | **跨语言/平台** | 极佳（HTTP 为通用标准） | 需统一序列化协议（如 Protobuf） |
   - **适用场景**：
     - **HTTP 转发**：
       - 面向外部客户端的 API 网关（RESTful API）。
       - 需要与现有 HTTP 服务（如第三方 API）集成。
       - 快速原型、调试友好，适合学习阶段（Phase 1）。
     - **TCP 微服务**：
       - **内部服务间通信**（如订单服务调用用户服务）。
       - 对**延迟敏感**、**高并发**的场景（如实时交易、消息推送）。
       - 需要**双向流式通信**（如 WebSocket 替代方案）。
       - 适合微服务架构深度优化阶段（Phase 2）。
   - **设计文档中的对比实践**：
     - **Phase 1**：使用 `HttpModule` + `axios` 实现 HTTP 转发，打通全链路。
     - **Phase 2**：将下游服务改造为 TCP 微服务（`createMicroservice`），网关改用 `ClientsModule` 的 `ClientProxy` 进行 RPC 调用，最终对比两种模式的差异。
