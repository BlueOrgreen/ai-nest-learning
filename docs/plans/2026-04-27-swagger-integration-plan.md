# Swagger 接入执行计划

> 日期：2026-04-27
> 涉及服务：`order-service`（主力）、`user-service`（用户 CRUD）、`gateway`（简化）
> 访问地址：`http://localhost:3002/docs`（订单服务）、`http://localhost:3001/docs`（用户服务）、`http://localhost:3010/docs`（网关）

---

## 一、目标

为这套 NestJS monorepo 接入 `@nestjs/swagger`，实现：

1. Order Service（3002）完整文档：所有路由、Query 参数、请求体、响应结构均可在 Swagger UI 中直接调试
2. User Service（3001）完整文档：用户 CRUD 路由、DTO 字段、响应结构完整文档化
3. Gateway（3010）简化文档：文档化自身直接处理的路由（`GET /`、`POST /auth/login`），代理路由注明下游地址

---

## 二、架构决策

### 为什么分两处挂，而不是只挂 Gateway？

Gateway 的代理路由是 `@All('api/orders/{*path}')` 通配符，Swagger 无法自动扫描真实参数结构。
Order Service 和 User Service 才是路由和 DTO 的真实宿主，Swagger 在这里能 100% 自动推断。

| 位置 | 说明 | 文档质量 |
|------|------|---------|
| Order Service (3002) | 真实路由宿主，DTO 在此 | 完整，自动推断 |
| User Service (3001) | 用户 CRUD 路由宿主，DTO 在此 | 完整，自动推断 |
| Gateway (3010) | 仅文档化自身两个路由，其余标注"代理至下游" | 简化，引导至 3001/docs、3002/docs |

---

## 三、文件变更清单

| 文件　　　　　　　　　　　　　　　　　　　　　　　　　　| 变更类型 | 说明　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| ---------------------------------------------------------| ----------| -----------------------------------------------------------------|
| `apps/order-service/src/main.ts`　　　　　　　　　　　　| 修改　　 | 初始化 SwaggerModule　　　　　　　　　　　　　　　　　　　　　　|
| `apps/order-service/src/orders/dto/create-order.dto.ts` | 修改　　 | 字段加 `@ApiProperty`　　　　　　　　　　　　　　　　　　　　　 |
| `apps/order-service/src/orders/dto/update-order.dto.ts` | 修改　　 | 字段加 `@ApiPropertyOptional`　　　　　　　　　　　　　　　　　 |
| `apps/order-service/src/orders/orders.controller.ts`　　| 修改　　 | 路由加 `@ApiOperation`、`@ApiQuery`、`@ApiBody`、`@ApiResponse` |
| `apps/user-service/src/main.ts`　　　　　　　　　　　　 | 修改　　 | 初始化 SwaggerModule　　　　　　　　　　　　　　　　　　　　　　|
| `apps/user-service/src/users/dto/create-user.dto.ts`　　| 修改　　 | 字段加 `@ApiProperty`　　　　　　　　　　　　　　　　　　　　　 |
| `apps/user-service/src/users/dto/update-user.dto.ts`　　| 修改　　 | 字段加 `@ApiPropertyOptional`　　　　　　　　　　　　　　　　　 |
| `apps/user-service/src/users/users.controller.ts`　　　 | 修改　　 | 路由加 `@ApiOperation`、`@ApiParam`、`@ApiBody`、`@ApiResponse` |
| `apps/user-service/src/health/health.controller.ts`　　 | 修改　　 | 健康检查路由加 `@ApiOperation`　　　　　　　　　　　　　　　　　|
| `apps/gateway/src/main.ts`　　　　　　　　　　　　　　　| 修改　　 | 初始化 SwaggerModule（简化版）　　　　　　　　　　　　　　　　　|
| `apps/gateway/src/app.controller.ts`　　　　　　　　　　| 修改　　 | 健康检查路由加装饰器　　　　　　　　　　　　　　　　　　　　　　|
| `apps/gateway/src/auth/auth.controller.ts`　　　　　　　| 修改　　 | 登录路由加装饰器　　　　　　　　　　　　　　　　　　　　　　　　|
| `apps/gateway/src/proxy/proxy.controller.ts`　　　　　　| 修改　　 | 代理路由加 `@ApiOperation` 说明　　　　　　　　　　　　　　　　 |

---

## 四、分步执行计划

### Step 1：安装依赖

```bash
# 在 monorepo 根目录执行，两个服务共享同一个 node_modules
pnpm add @nestjs/swagger swagger-ui-express
```

> `swagger-ui-express` 是 `@nestjs/swagger` 在 Express 平台下的 peer dependency，必须显式安装。

---

### Step 2：Order Service — 初始化 Swagger

修改 `apps/order-service/src/main.ts`，在 `app.listen()` 前插入：

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Order Service API')
  .setDescription('订单服务接口文档，含并发异常 / 隔离级别 / 锁机制演示接口')
  .setVersion('1.0')
  .addBearerAuth(
    { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    'access-token',
  )
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);
// 访问：http://localhost:3002/docs
// JSON：http://localhost:3002/docs-json
```

---

### Step 3：给 DTO 添加 `@ApiProperty`

#### `create-order.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'uuid-product-xxx', description: '商品 ID' })
  productId: string;

  @ApiProperty({ example: 'uuid-user-yyy', description: '用户 ID' })
  userId: string;

  @ApiProperty({ example: 2, description: '购买数量，必须 >= 1' })
  quantity: number;

  @ApiPropertyOptional({ example: '生日礼物', description: '订单备注（可选）' })
  description?: string;
}
```

#### `update-order.dto.ts`

所有字段改为 `@ApiPropertyOptional`（更新接口字段均为可选）：

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrderDto {
  @ApiPropertyOptional({ example: 2 })
  quantity?: number;

  @ApiPropertyOptional({ example: '修改备注' })
  description?: string;
}
```

---

### Step 4：给 Controller 添加路由级装饰器

在 `orders.controller.ts` 顶部引入：

```typescript
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiParam, ApiQuery, ApiBody, ApiResponse,
} from '@nestjs/swagger';
```

Controller 类级别：

```typescript
@ApiTags('orders')
@Controller('orders')
export class OrdersController { ... }
```

各路由装饰器示例（按分组列出）：

#### CRUD 路由

```typescript
// GET /orders
@ApiOperation({ summary: '获取所有订单（按创建时间倒序）' })
@ApiResponse({ status: 200, description: '订单列表' })

// GET /orders/user/:userId
@ApiOperation({ summary: '获取指定用户的所有订单' })
@ApiParam({ name: 'userId', example: 'uuid-user-yyy' })

// GET /orders/:id
@ApiOperation({ summary: '根据 ID 获取单个订单' })
@ApiParam({ name: 'id', example: 'uuid-order-zzz' })
@ApiResponse({ status: 404, description: 'Order not found' })

// POST /orders
@ApiOperation({ summary: '创建订单（含事务：扣库存 + 建订单）' })
@ApiBody({ type: CreateOrderDto })
@ApiResponse({ status: 201, description: '创建成功' })
@ApiResponse({ status: 400, description: '库存不足' })

// PATCH /orders/:id
@ApiOperation({ summary: '更新订单信息' })
@ApiParam({ name: 'id' })
@ApiBody({ type: UpdateOrderDto })

// DELETE /orders/:id
@ApiOperation({ summary: '删除订单' })
@ApiParam({ name: 'id' })
@ApiResponse({ status: 204, description: '删除成功，无响应体' })
```

#### 阶段二：并发异常演示

```typescript
// GET /orders/demo/dirty-read
@ApiOperation({
  summary: '【演示】脏读 (Dirty Read)',
  description: '配合 POST /orders/demo/simulate-dirty-write 使用。先调用写接口（5秒内不提交），再调用此接口，在 READ UNCOMMITTED 级别下可读到未提交数据。',
})
@ApiQuery({ name: 'productId', required: true, example: 'uuid-product-xxx' })

// POST /orders/demo/simulate-dirty-write
@ApiOperation({
  summary: '【演示】制造脏写场景',
  description: '修改 stock 后暂停 5 秒再 ROLLBACK，制造未提交的脏数据时间窗口。',
})
@ApiBody({ schema: { example: { productId: 'uuid-xxx', dirtyStock: 0 } } })

// GET /orders/demo/non-repeatable-read
@ApiOperation({
  summary: '【演示】不可重复读 (Non-repeatable Read)',
  description: '接口会等待 3 秒。在等待期间修改对应商品 stock 并提交，观察 firstRead 和 secondRead 是否不同。',
})
@ApiQuery({ name: 'productId', required: true, example: 'uuid-product-xxx' })

// GET /orders/demo/phantom-read
@ApiOperation({
  summary: '【演示】幻读 (Phantom Read)',
  description: '接口会等待 3 秒。在等待期间插入该用户的新订单，观察 firstCount 和 secondCount 是否不同。',
})
@ApiQuery({ name: 'userId', required: true, example: 'uuid-user-yyy' })
```

#### 阶段三：隔离级别

```typescript
// GET /orders/demo/isolation-level
@ApiOperation({ summary: '【演示】查询当前 MySQL 会话事务隔离级别' })

// GET /orders/demo/isolation-level/read
@ApiOperation({
  summary: '【演示】在指定隔离级别下读取库存（等待 2 秒）',
  description: 'level 可选值：READ_UNCOMMITTED / READ_COMMITTED / REPEATABLE_READ / SERIALIZABLE',
})
@ApiQuery({ name: 'productId', required: true })
@ApiQuery({
  name: 'level',
  required: false,
  enum: ['READ_UNCOMMITTED', 'READ_COMMITTED', 'REPEATABLE_READ', 'SERIALIZABLE'],
  example: 'REPEATABLE_READ',
})
```

#### 阶段四：锁机制

```typescript
// GET /orders/demo/lock/shared
@ApiOperation({
  summary: '【演示】共享锁 FOR SHARE（持锁 2 秒）',
  description: '并发调用两次，两个请求都能立即获得共享锁（读读兼容）。',
})
@ApiQuery({ name: 'productId', required: true })

// GET /orders/demo/lock/exclusive
@ApiOperation({
  summary: '【演示】排他锁 FOR UPDATE（持锁 3 秒）',
  description: '并发调用两次，第二个请求被阻塞。观察返回的 waitedMs：第二个请求接近 3000ms。',
})
@ApiQuery({ name: 'productId', required: true })

// POST /orders/demo/lock/deadlock
@ApiOperation({
  summary: '【演示】死锁',
  description: '两个事务以相反顺序请求两个商品的排他锁，触发 MySQL 自动死锁检测与回滚。productIdA 和 productIdB 必须是不同的真实商品 ID。',
})
@ApiBody({ schema: { example: { productIdA: 'uuid-a', productIdB: 'uuid-b' } } })
```

---

### Step 5：验证 Order Service 文档

```bash
pnpm start:order
# 访问：http://localhost:3002/docs
```

检查项：
- [ ] 所有路由出现在文档中，分组正确（`orders` tag）
- [ ] Query 参数有 example 值
- [ ] POST 接口有 Request Body schema
- [ ] 枚举类型（level）出现下拉选项
- [ ] `docs-json` 端点可访问（供日后工具消费）

---

### Step 6：User Service — 初始化 Swagger

修改 `apps/user-service/src/main.ts`，在 `app.listen()` 前插入：

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('User Service API')
  .setDescription('用户服务接口文档，包含用户 CRUD 及健康检查')
  .setVersion('1.0')
  .addBearerAuth(
    { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    'access-token',
  )
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);
// 访问：http://localhost:3001/docs
// JSON：http://localhost:3001/docs-json
```

---

### Step 7：给 User Service DTO 添加 `@ApiProperty`

#### `create-user.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: '张三', description: '用户姓名' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'zhangsan@example.com', description: '邮箱（唯一）' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'user',
    enum: ['user', 'admin'],
    description: '用户角色，默认 user',
    default: 'user',
  })
  @IsEnum(['user', 'admin'])
  role: 'user' | 'admin' = 'user';
}
```

#### `update-user.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: '李四', description: '用户姓名' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'lisi@example.com', description: '邮箱' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'admin',
    enum: ['user', 'admin'],
    description: '用户角色',
  })
  @IsEnum(['user', 'admin'])
  @IsOptional()
  role?: 'user' | 'admin';
}
```

---

### Step 8：给 User Service Controller 添加装饰器

#### `users.controller.ts`

顶部引入：

```typescript
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiParam, ApiBody, ApiResponse,
} from '@nestjs/swagger';
```

类级别：

```typescript
@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController { ... }
```

各路由装饰器：

```typescript
// GET /users
@ApiOperation({ summary: '获取所有用户（按创建时间倒序）' })
@ApiResponse({ status: 200, description: '用户列表' })

// GET /users/:id
@ApiOperation({ summary: '根据 UUID 获取单个用户' })
@ApiParam({ name: 'id', example: 'uuid-user-xxx', description: '用户 UUID' })
@ApiResponse({ status: 200, description: '用户信息' })
@ApiResponse({ status: 404, description: 'User not found' })

// POST /users
@ApiOperation({ summary: '创建新用户' })
@ApiBody({ type: CreateUserDto })
@ApiResponse({ status: 201, description: '创建成功，返回用户对象' })
@ApiResponse({ status: 409, description: 'Email 已存在' })

// PATCH /users/:id
@ApiOperation({ summary: '部分更新用户信息' })
@ApiParam({ name: 'id', example: 'uuid-user-xxx' })
@ApiBody({ type: UpdateUserDto })
@ApiResponse({ status: 200, description: '更新后的用户对象' })
@ApiResponse({ status: 404, description: 'User not found' })

// DELETE /users/:id
@ApiOperation({ summary: '删除用户' })
@ApiParam({ name: 'id', example: 'uuid-user-xxx' })
@ApiResponse({ status: 204, description: '删除成功，无响应体' })
@ApiResponse({ status: 404, description: 'User not found' })
```

#### `health/health.controller.ts`

```typescript
@ApiTags('health')
@ApiOperation({
  summary: '数据库健康检查',
  description: '通过 @nestjs/terminus 执行 SELECT 1 探针，检测 DB 连通性。',
})
@ApiResponse({ status: 200, description: 'DB 正常' })
@ApiResponse({ status: 503, description: 'DB 异常' })
```

---

### Step 9：验证 User Service 文档

```bash
pnpm start:user
# 访问：http://localhost:3001/docs
```

检查项：
- [ ] `users` 和 `health` 两个 tag 出现
- [ ] POST /users 有完整的 Request Body schema（含 role 枚举下拉）
- [ ] 404 / 409 响应均有描述
- [ ] `docs-json` 端点可访问

---

### Step 10：Gateway — 初始化简化 Swagger

修改 `apps/gateway/src/main.ts`：

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('Gateway API')
  .setDescription(
    '网关入口文档。\n\n' +
    '- 用户接口（`/api/users/*`）代理至 User Service，详细文档见 [http://localhost:3001/docs](http://localhost:3001/docs)\n' +
    '- 订单接口（`/api/orders/*`）代理至 Order Service，详细文档见 [http://localhost:3002/docs](http://localhost:3002/docs)\n' +
    '- 认证：POST /auth/login 获取 JWT，后续请求在 Authorization 头携带 `Bearer <token>`'
  )
  .setVersion('1.0')
  .addBearerAuth(
    { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    'access-token',
  )
  .build();

const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('docs', app, swaggerDocument);
// 访问：http://localhost:3010/docs
```

---

### Step 11：给 Gateway 自身路由加装饰器

#### `app.controller.ts`

```typescript
@ApiTags('health')
@ApiOperation({ summary: '健康检查', description: '无需登录，返回字符串 "Hello World!"' })
@ApiResponse({ status: 200, description: 'OK' })
@Get()
@Public()
getHello(): string { ... }
```

#### `auth.controller.ts`

```typescript
@ApiTags('auth')

// POST /auth/login
@ApiOperation({ summary: '用户登录', description: '返回 JWT access_token。限流：5次/分钟（防暴力破解）。' })
@ApiBody({ schema: { example: { email: 'admin@example.com', password: '123456' } } })
@ApiResponse({ status: 200, description: '登录成功，返回 { access_token: "eyJ..." }' })
@ApiResponse({ status: 401, description: '邮箱或密码错误' })
@ApiResponse({ status: 429, description: '登录请求过于频繁（5次/分钟限制）' })
```

#### `proxy.controller.ts`

```typescript
@ApiTags('proxy（代理）')

// ordersRoot & ordersProxy
@ApiOperation({
  summary: '代理：订单服务',
  description: '所有 /api/orders/* 请求透传至 Order Service (3002)。\n\n完整接口文档见 http://localhost:3002/docs',
})

// usersProxy
@ApiOperation({
  summary: '代理：用户服务',
  description: '所有 /api/users/* 请求透传至 User Service (3001)。\n\n完整接口文档见 http://localhost:3001/docs',
})

// proxy (兜底)
@ApiOperation({
  summary: '代理：其他服务（需 JWT）',
  description: '所有其他 /api/* 请求透传至对应下游服务，需携带 Bearer Token。',
})
@ApiBearerAuth('access-token')
```

---

### Step 12：验证 Gateway 文档

```bash
pnpm start:gateway
# 访问：http://localhost:3010/docs
```

检查项：
- [ ] `health`、`auth`、`proxy（代理）` 三个 tag 出现
- [ ] POST /auth/login 的 Authorize 流程可以走通（输入 token → 后续请求自动带 Bearer）
- [ ] 代理路由有明确说明，分别引导至 3001/docs 和 3002/docs

---

## 五、注意事项

| 问题 | 处理方式 |
|------|---------|
| `swagger-ui-express` 未安装导致 500 | 确保 `pnpm add swagger-ui-express` 已执行 |
| `@ApiProperty` 未加导致 DTO 在文档中显示为空对象 `{}` | 检查 DTO 每个字段是否都有装饰器 |
| 通配路由 `{*path}` 在 Swagger 中显示为乱码 | `proxy.controller.ts` 的通配路由手动加 `@ApiOperation` 覆盖即可，不影响功能 |
| Swagger 访问 `/docs` 和后端路由冲突 | 本项目无 `/docs` 业务路由，不冲突 |
| 生产环境不应暴露 Swagger | 用 `if (process.env.NODE_ENV !== 'production')` 包裹 `SwaggerModule.setup(...)` |

---

## 六、Git 提交计划

| 提交 | 内容 |
|------|------|
| `feat(order-service): 接入 Swagger，完整文档化所有路由` | Step 2–5 |
| `feat(user-service): 接入 Swagger，完整文档化所有路由` | Step 6–9 |
| `feat(gateway): 接入简化 Swagger，文档化自身路由` | Step 10–12 |
| `docs: 新增 Swagger 接入执行计划` | 本文件 |

---

## 七、Swagger 装饰器速查

本节解释本项目中用到的全部 `@nestjs/swagger` 装饰器，按使用位置分类。

---

### 7.1 DocumentBuilder — 构建文档元信息

`DocumentBuilder` 是链式构建器，用于配置整个服务的 Swagger 文档元信息，最终调用 `.build()` 产出配置对象。

| 方法 | 说明 | 本项目使用示例 |
|------|------|--------------|
| `.setTitle(title)` | 文档标题，显示在 Swagger UI 顶部 | `'Order Service API'` |
| `.setDescription(desc)` | 文档描述，支持 Markdown，显示在标题下方 | 含代理说明和链接的多行文本 |
| `.setVersion(ver)` | API 版本号，显示在标题旁 | `'1.0'` |
| `.addBearerAuth(options, name)` | 注册一种安全方案（Bearer JWT），name 作为方案标识符，供 `@ApiBearerAuth(name)` 引用 | `addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')` |
| `.build()` | 终止链式调用，返回 `OpenAPIObject` 配置对象 | 必须调用，传入 `SwaggerModule.createDocument()` |

---

### 7.2 SwaggerModule — 注册文档到 NestJS 应用

| 方法 | 签名 | 说明 |
|------|------|------|
| `SwaggerModule.createDocument(app, config)` | `(app, OpenAPIObject) => OpenAPIObject` | 扫描整个应用所有 Controller / DTO 的装饰器，生成完整的 OpenAPI JSON 规范 |
| `SwaggerModule.setup(path, app, document)` | `(string, app, OpenAPIObject) => void` | 在指定路径挂载 Swagger UI（`/docs`）和 JSON 端点（`/docs-json`） |

调用后自动提供两个端点：
- `GET /docs` → Swagger UI 页面
- `GET /docs-json` → 原始 OpenAPI JSON（可供 Postman / openapi-generator 消费）

---

### 7.3 Controller 类级别装饰器

这些装饰器加在 `@Controller()` 类上，对该 Controller 下所有路由生效。

| 装饰器 | 说明 | 本项目用法 |
|--------|------|----------|
| `@ApiTags('tag名')` | 将该 Controller 下所有路由归到同一个分组标签，Swagger UI 中折叠显示 | `@ApiTags('orders')`、`@ApiTags('users')`、`@ApiTags('auth')` |
| `@ApiBearerAuth('name')` | 标记该 Controller 下所有路由需要 Bearer Token 认证，`name` 必须与 `addBearerAuth()` 的第二个参数一致 | `@ApiBearerAuth('access-token')` |

---

### 7.4 路由级别装饰器

这些装饰器加在具体的方法上，描述单个接口。

#### `@ApiOperation`

描述接口的基本信息，显示在折叠面板的标题和展开后的说明区。

```typescript
@ApiOperation({
  summary: '一句话概括（显示在折叠面板标题）',
  description: '详细说明，支持 Markdown，显示在展开后的 Description 区域',
})
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `summary` | `string` | 简短摘要（必填，显示在列表视图） |
| `description` | `string` | 详细描述，可以是多行 Markdown |
| `deprecated` | `boolean` | 设为 `true` 则接口显示删除线，标记为废弃 |

---

#### `@ApiParam`

描述路由路径中的动态参数（`:id`、`:userId` 等）。

```typescript
@ApiParam({
  name: 'id',               // 必须与路由中的参数名完全一致
  description: '用户 UUID',
  example: 'uuid-user-xxx',
  required: true,           // 路径参数默认都是 required
})
```

---

#### `@ApiQuery`

描述 URL Query String 参数（`?productId=xxx`）。

```typescript
@ApiQuery({
  name: 'level',
  required: false,          // 可选参数
  enum: ['READ_UNCOMMITTED', 'READ_COMMITTED', 'REPEATABLE_READ', 'SERIALIZABLE'],
  example: 'REPEATABLE_READ',
  description: '事务隔离级别',
})
```

| 字段 | 说明 |
|------|------|
| `required` | `false` 表示非必填，Swagger UI 中该参数旁显示"optional" |
| `enum` | 传入字符串数组，UI 中渲染为下拉选择框 |
| `example` | 预填默认值，方便调试 |

---

#### `@ApiBody`

描述请求体（`POST`、`PATCH`、`PUT` 接口使用）。有两种写法：

**写法一：引用 DTO 类（推荐，自动读取 `@ApiProperty` 信息）**

```typescript
@ApiBody({ type: CreateOrderDto })
```

**写法二：内联 schema（DTO 在其他服务时、或临时演示接口）**

```typescript
@ApiBody({
  schema: {
    example: { productId: 'uuid-xxx', dirtyStock: 0 },
  },
})
```

---

#### `@ApiResponse`

描述接口可能返回的 HTTP 状态码和含义。

```typescript
@ApiResponse({ status: 200, description: '操作成功' })
@ApiResponse({ status: 201, description: '创建成功，返回新建资源' })
@ApiResponse({ status: 204, description: '删除成功，无响应体' })
@ApiResponse({ status: 400, description: '参数校验失败 / 库存不足' })
@ApiResponse({ status: 401, description: '未登录或 Token 无效' })
@ApiResponse({ status: 404, description: '资源不存在' })
@ApiResponse({ status: 409, description: '冲突（如 Email 重复）' })
@ApiResponse({ status: 429, description: '请求过于频繁（限流）' })
@ApiResponse({ status: 503, description: '服务不可用（DB 宕机）' })
```

> **注意**：`status: 204` 接口在 Swagger UI 中点击"Try it out"时不会显示响应体，这是 HTTP 规范预期行为，非 bug。

---

### 7.5 DTO 字段级别装饰器

`@ApiProperty` 系列装饰器加在 DTO 类的属性上，让 Swagger 能自动推断请求体 / 响应体的 Schema。

**若不加这些装饰器，DTO 在 Swagger UI 中显示为空对象 `{}`。**

#### `@ApiProperty`（必填字段）

```typescript
@ApiProperty({
  description: '字段说明',      // 显示在 Schema 描述旁
  example: 'uuid-xxx',          // 预填示例值，点击"Try it out"时自动填入
  type: String,                 // 显式指定类型（一般可省略，TS 自动推断）
  enum: ['user', 'admin'],      // 枚举类型，UI 中渲染为下拉
  default: 'user',              // 默认值说明
  minimum: 1,                   // 数值类型的最小值约束（仅文档说明，不做校验）
  maximum: 9999,                // 数值类型的最大值约束
})
```

#### `@ApiPropertyOptional`（可选字段）

等价于 `@ApiProperty({ required: false })`，语义更清晰，用于 `UpdateDto` 中所有可选字段。

```typescript
@ApiPropertyOptional({ example: '修改备注', description: '订单备注' })
description?: string;
```

---

### 7.6 装饰器作用域汇总

```
应用级
└── DocumentBuilder + SwaggerModule.setup()   ← main.ts，全局生效

Controller 类级
├── @ApiTags('tag')                            ← 路由分组
└── @ApiBearerAuth('name')                    ← 整个 Controller 需要认证

路由方法级
├── @ApiOperation({ summary, description })   ← 接口描述
├── @ApiParam({ name, description, example }) ← 路径参数
├── @ApiQuery({ name, required, enum })       ← Query 参数
├── @ApiBody({ type | schema })               ← 请求体
└── @ApiResponse({ status, description })     ← 响应说明（可多个）

DTO 属性级
├── @ApiProperty(options)                     ← 必填字段
└── @ApiPropertyOptional(options)             ← 可选字段（required: false）
```

---

### 7.7 常见陷阱

| 陷阱 | 原因 | 解决方式 |
|------|------|---------|
| DTO 在文档中显示为 `{}` | DTO 属性没有加 `@ApiProperty` | 给每个字段加 `@ApiProperty` 或 `@ApiPropertyOptional` |
| `@ApiBearerAuth()` 不生效 | `name` 与 `addBearerAuth()` 的第二个参数不一致 | 保持两处 `name` 相同，如 `'access-token'` |
| 枚举字段没有下拉选项 | 只用 TS 类型，没有传 `enum` 给 `@ApiProperty` | 在 `@ApiProperty({ enum: ['user', 'admin'] })` 显式传入 |
| 通配路由在 Swagger 显示乱码 | Express 通配符语法 `{*path}` 不是合法 OpenAPI 路径 | 手动加 `@ApiOperation` 覆盖，路由功能不受影响 |
| `swagger-ui-express` 500 错误 | peer dependency 未安装 | `pnpm add swagger-ui-express` |

---

## 八、Git 提交记录

| 字段 | 内容 |
|------|------|
| Commit | 待填写 |
| 时间 | 2026-04-27 |
| Message | `docs: 新增 Swagger 接入执行计划` |
