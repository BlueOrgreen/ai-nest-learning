# @HttpCode 详解

> 日期：2026-04-22  
> 涉及文件：  
> - `apps/gateway/src/auth/auth.controller.ts`  
> - `apps/order-service/src/orders/orders.controller.ts`  
> - `apps/user-service/src/users/users.controller.ts`

---

## 一、背景：NestJS 的默认状态码规则

HTTP 状态码是客户端判断请求结果的依据。NestJS 根据路由的 HTTP 方法设置了一套默认状态码：

| HTTP 方法 | NestJS 默认状态码 | 含义 |
|-----------|-----------------|------|
| `GET` | 200 OK | 查询成功 |
| `POST` | **201 Created** | 资源创建成功 |
| `PATCH` / `PUT` | 200 OK | 更新成功 |
| `DELETE` | 200 OK | 删除成功 |

这套默认值在大多数情况下没问题，但有两种场景需要手动覆盖：

1. `POST` 方法做的不是"创建资源"的操作 → 默认 201 语义错误
2. `DELETE` 方法成功后不应该有响应体 → 应该返回 204

`@HttpCode()` 就是用来覆盖这个默认值的装饰器。

---

## 二、情景一：`POST /auth/login` 为什么要加 `@HttpCode(HttpStatus.OK)`

### 项目代码

```ts
// apps/gateway/src/auth/auth.controller.ts

@Throttle({ default: { limit: 5, ttl: 60000 } })
@Post('login')
@Public()
@HttpCode(HttpStatus.OK)   // ← 手动改为 200
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

### 问题根源

`login` 是 `@Post` 方法，NestJS 默认返回 **201 Created**。

但 **201 的语义是"在服务器上新创建了一个资源"**，通常伴随 `Location` 响应头指向新资源的地址。

登录操作不符合这个语义：
- 没有创建任何新资源
- 只是验证了用户身份，返回了一个临时 token
- 正确语义是"请求成功，返回数据" = **200 OK**

### 不加 `@HttpCode` 的后果

```
POST /auth/login
← 201 Created   ← ❌ 语义错误：客户端可能误以为创建了某个资源
  { "access_token": "eyJ..." }
```

### 加了 `@HttpCode(HttpStatus.OK)` 的效果

```
POST /auth/login
← 200 OK        ← ✅ 正确：这是一个动作（验证），不是创建
  { "access_token": "eyJ..." }
```

### 类似的场景

同样需要把 `POST` 改成 200 的情景还有：
- `POST /auth/logout` — 退出登录
- `POST /search` — 查询操作（body 太复杂用 GET 不合适时）
- `POST /verify` — 验证类操作

**规则**：用 `@Post` 但操作的语义不是"创建资源"时，需要用 `@HttpCode` 手动指定正确状态码。

---

## 三、情景二：`DELETE /:id` 为什么要加 `@HttpCode(HttpStatus.NO_CONTENT)`

### 项目代码

```ts
// apps/order-service/src/orders/orders.controller.ts
// apps/user-service/src/users/users.controller.ts（同样的写法）

@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)  // ← 手动改为 204
remove(@Param('id') id: string) {
  return this.ordersService.remove(id);
}
```

### 204 No Content 的含义

**204 = 请求成功处理，但没有内容需要返回。**

这是 REST API 设计中删除操作的标准状态码：
- 资源已经被删除了
- 不需要返回任何数据给客户端
- 响应体为空

### 204 的特殊机制

204 有一个重要的 HTTP 协议规定：**即使 handler 返回了值，浏览器/HTTP 客户端也不会解析响应体，响应体会被忽略。**

```ts
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
remove(@Param('id') id: string) {
  return this.ordersService.remove(id);  // 即使这里返回了数据
  // 客户端也收不到响应体，因为 204 协议规定响应体必须为空
}
```

### 不加 `@HttpCode` 的后果

```
DELETE /orders/123
← 200 OK        ← ❌ 语义模糊：200 通常意味着有数据返回
  { "affected": 1 }  ← 多余的响应体
```

### 加了 `@HttpCode(HttpStatus.NO_CONTENT)` 的效果

```
DELETE /orders/123
← 204 No Content  ← ✅ 正确：资源已删除，无需返回内容
  （无响应体）
```

### 为什么 NestJS 的 DELETE 默认是 200 而不是 204？

因为有些删除操作确实需要返回数据（比如返回被删除资源的快照），NestJS 保守地默认 200。需要 204 时手动指定。

---

## 四、`HttpStatus` 枚举

项目里用的是 `HttpStatus.OK`、`HttpStatus.NO_CONTENT` 而不是直接写数字，原因：

```ts
@HttpCode(200)                    // ❌ 魔法数字，可读性差
@HttpCode(HttpStatus.OK)          // ✅ 语义清晰，一眼看懂

@HttpCode(204)                    // ❌
@HttpCode(HttpStatus.NO_CONTENT)  // ✅
```

`HttpStatus` 是 NestJS 提供的枚举，把所有标准 HTTP 状态码都命名化：

```ts
enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  // ...
}
```

---

## 五、`@HttpCode` 与 `LoggingInterceptor` 的关联

在上一篇笔记（`2026-04-22-logging-interceptor-explained.md`）中提到：

> NestJS 在调用 handler 之前，已经根据路由配置把 `statusCode` 设好了。

`@HttpCode` 正是在这个阶段生效的。NestJS 解析路由时读取 `@HttpCode` 元数据，在执行 handler 之前就把 `res.statusCode` 设置好，所以 `LoggingInterceptor` 的 `tap` 回调里能拿到正确的状态码。

```
NestJS 解析路由
    ↓
读取 @HttpCode 元数据 → res.statusCode = 200 (或 204)
    ↓
执行 Guard
    ↓
执行 Interceptor（LoggingInterceptor 记录 start）
    ↓
执行 handler
    ↓
tap 触发 → 此时 res.statusCode 已经是 @HttpCode 设置的值 ✅
```

---

## 六、`@HttpCode` 与 `@Res()` 的关系（注意事项）

项目里 proxy 路由使用了 `@Res()` 直接操控响应流，**此时 `@HttpCode` 完全失效**：

```ts
// @HttpCode 在这里没有任何效果
@All('api/orders')
@HttpCode(200)  // ← 无效！
async ordersRoot(@Req() req, @Res() res: Response) {
  // 你自己调用 res.status() 才是最终状态码
  res.status(200).json({ ... });
}
```

**规则**：一旦注入 `@Res()`，NestJS 的所有响应相关装饰器（`@HttpCode`、`@Header`）都会失效，响应完全由你手动控制。

---

## 七、总结

| 场景 | 默认状态码 | 应该用 | 解决方案 |
|------|-----------|-------|---------|
| `POST` 做验证/动作（非创建） | 201 Created | 200 OK | `@HttpCode(HttpStatus.OK)` |
| `DELETE` 删除成功无返回 | 200 OK | 204 No Content | `@HttpCode(HttpStatus.NO_CONTENT)` |
| 使用 `@Res()` 手动控制响应 | — | 手动 `res.status(xxx)` | `@HttpCode` 在此场景无效 |
