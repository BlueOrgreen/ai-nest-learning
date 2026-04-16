# Step 4 — 网关实现动态路由转发（HTTP 模式）

**日期**：2026-04-16  
**目标**：网关根据请求路径前缀，将请求动态转发到对应的下游服务（user-service / order-service），并将响应原样返回给客户端。

---

## 架构说明

```
Client
  ↓  GET /api/users/...   →  [Gateway:3000]  → http://localhost:3001/users/...  → user-service
  ↓  GET /api/orders/...  →  [Gateway:3000]  → http://localhost:3002/orders/... → order-service
```

**路由规则（路径前缀映射）：**

| 网关路径前缀 | 转发目标 | 下游路径前缀 |
|-------------|----------|-------------|
| `/api/users` | user-service:3001 | `/users` |
| `/api/orders` | order-service:3002 | `/orders` |

---

## 文件结构

```
apps/gateway/src/
├── proxy/
│   ├── proxy.module.ts          # 注册 HttpModule + PROXY_ROUTES token
│   ├── proxy.controller.ts      # 通配符路由捕获所有请求
│   └── proxy.service.ts         # 解析路由规则 + axios 转发
├── config/
│   └── proxy-routes.config.ts   # 路由规则配置表（可扩展）
├── app.module.ts                # 引入 ProxyModule
└── main.ts                      # 启用 ValidationPipe + 日志
```

---

## 实现细节

### 1. 路由规则配置（proxy-routes.config.ts）

集中管理前缀 → 目标 URL 的映射关系，支持未来扩展新服务：

```ts
export const PROXY_ROUTES = [
  { prefix: '/api/users',  target: 'http://localhost:3001', stripPrefix: '/api' },
  { prefix: '/api/orders', target: 'http://localhost:3002', stripPrefix: '/api' },
];
```

### 2. ProxyController — 通配符捕获

使用 NestJS 通配符路由 `*` 捕获 `/api/*` 下所有方法（GET/POST/PATCH/DELETE）：

```ts
@All('api/*')
async proxy(@Req() req, @Res() res) { ... }
```

### 3. ProxyService — 转发逻辑

1. 从请求路径中提取前缀，匹配路由规则
2. 构造目标 URL：`target + 去掉 stripPrefix 后的路径`
3. 透传 headers（过滤 host）、query string、body
4. 将下游响应的 status code + headers + body 原样返回
5. 下游不可达时返回 502 Bad Gateway

### 4. 关键技术点

- **HttpModule**：`@nestjs/axios`，基于 axios，支持 Observable/Promise
- **透传 headers**：去掉 `host`，保留 `content-type`、`authorization` 等
- **透传 query**：`req.query` 直接附加到目标 URL
- **错误处理**：捕获 axios 错误，区分 4xx（下游返回）和 5xx（网关自身错误）

---

## 验证步骤

```bash
# 启动三个服务
pnpm start:user    # :3001
pnpm start:order   # :3002
pnpm start:gateway # :3000

# 通过网关访问 user-service
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","role":"user"}'

# 通过网关查询所有用户
curl http://localhost:3000/api/users

# 通过网关访问 order-service
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"<user-id>","description":"Test Order","amount":99.9}'

curl http://localhost:3000/api/orders
```

---

## 对应 Commit

```
feat(step-4): 网关实现动态路由转发（HTTP 模式）
```
