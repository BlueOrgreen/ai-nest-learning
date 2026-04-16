# Step 5 — JWT 认证 & 角色鉴权

**日期：** 2026-04-16  
**目标：** 在网关层统一实现 JWT 登录签发、请求验证、角色鉴权，下游服务无需关心认证逻辑。

---

## 一、整体方案

```
POST /auth/login  ──→  AuthController  ──→  AuthService.login()
                          ↓ 验证 email+password（调用 user-service HTTP）
                          ↓ 签发 JWT（sub: userId, email, role）
                          ← 返回 { access_token }

其他所有请求
  → JwtAuthGuard（验证 Bearer Token，解码 payload 写入 req.user）
  → RolesGuard（读取 @Roles() 元数据，对比 req.user.role）
  → ProxyService（透传 x-user-id / x-user-role header 给下游）
```

---

## 二、文件结构

```
apps/gateway/src/
├── auth/
│   ├── auth.module.ts          # 注册 JwtModule、PassportModule
│   ├── auth.controller.ts      # POST /auth/login
│   ├── auth.service.ts         # 验证用户 + 签发 JWT
│   ├── jwt.strategy.ts         # PassportStrategy(JwtStrategy)，解码 token
│   ├── jwt-auth.guard.ts       # 全局 JWT Guard（白名单跳过）
│   ├── roles.guard.ts          # 角色鉴权 Guard
│   ├── roles.decorator.ts      # @Roles('admin') 装饰器
│   └── dto/
│       └── login.dto.ts        # { email, password }
```

---

## 三、JWT Payload 结构

```json
{
  "sub": "uuid-of-user",
  "email": "alice@test.com",
  "role": "user",
  "iat": 1713200000,
  "exp": 1713286400
}
```

---

## 四、白名单规则

`JwtAuthGuard` 全局注册，以下路径**跳过验证**：
- `POST /auth/login`
- `GET /`（health check）

---

## 五、角色权限规划（当前阶段）

| 接口 | 所需角色 |
|------|---------|
| `GET /api/users` | 所有登录用户 |
| `GET /api/users/:id` | 所有登录用户 |
| `POST /api/users` | admin |
| `PATCH /api/users/:id` | admin |
| `DELETE /api/users/:id` | admin |
| `GET /api/orders` | 所有登录用户 |
| `POST /api/orders` | 所有登录用户 |
| `PATCH /api/orders/:id` | 所有登录用户 |
| `DELETE /api/orders/:id` | admin |

> 当前阶段统一在网关 ProxyController 上标注 `@Roles()`，后续可拆分为细粒度路由。

---

## 六、密码说明（学习阶段简化）

> 本阶段为学习目的，user-service 的 User 实体**没有 password 字段**。  
> 登录验证策略：只要 email 存在于 user-service，即视为验证通过（模拟场景）。  
> Step 5+ 可扩展：user 实体增加 `passwordHash`，AuthService 用 bcrypt 比对。
