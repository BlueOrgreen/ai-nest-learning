# Insomnia 接口测试使用教程

**日期**：2026-04-16  
**适用**：NestJS Gateway 项目（gateway / user-service / order-service）

---

## 一、安装 Insomnia

前往 [https://insomnia.rest/download](https://insomnia.rest/download) 下载并安装 Insomnia（免费版即可）。

---

## 二、导入 Collection

1. 打开 Insomnia，点击左上角 **New Collection** 旁的 **+** 按钮，选择 **Import**
2. 选择 **From File**，导入项目中的：
   ```
   docs/insomnia-collection.json
   ```
3. 导入成功后，左侧会出现 **NestJS Gateway** 工作区，包含：
   - `🌐 Gateway（通过网关访问）` — 所有接口走 :3000 网关
   - `🔧 直连下游（绕过网关，调试用）` — 直连 :3001 / :3002

---

## 三、配置环境变量

Collection 使用环境变量统一管理 URL，无需每次手动改地址。

1. 点击右上角 **No Environment** → **Manage Environments**
2. 选择 **Base Environment**，确认以下变量已设置：

   ```json
   {
     "gateway_url": "http://localhost:3000",
     "user_service_url": "http://localhost:3001",
     "order_service_url": "http://localhost:3002",
     "user_id": "",
     "order_id": ""
   }
   ```

3. `user_id` 和 `order_id` 先留空，创建资源后再填入。

---

## 四、启动服务

打开三个终端，分别运行：

```bash
# 终端 1
pnpm start:user     # user-service on :3001

# 终端 2
pnpm start:order    # order-service on :3002

# 终端 3
pnpm start:gateway  # gateway on :3000
```

---

## 五、推荐测试流程

### Step 1 — 创建用户

选择 `🌐 Gateway > Users > POST 创建用户`，Body 已预填：

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "role": "user"
}
```

点击 **Send**，响应示例：

```json
{
  "id": "a1b2c3d4-...",
  "name": "Alice",
  "email": "alice@example.com",
  "role": "user",
  "createdAt": "2026-04-16T..."
}
```

**复制 `id` 值**，填入 Base Environment 的 `user_id` 字段。

---

### Step 2 — 查询所有用户

选择 `GET 查询所有用户`，点击 **Send**，验证返回数组包含刚创建的用户。

---

### Step 3 — 创建订单（依赖 user_id）

选择 `🌐 Gateway > Orders > POST 创建订单`，Body：

```json
{
  "userId": "{{ _.user_id }}",
  "description": "My First Order",
  "amount": 99.99
}
```

> `{{ _.user_id }}` 会自动替换为环境变量的值。

响应后**复制 `id`**，填入 Base Environment 的 `order_id`。

---

### Step 4 — 更新订单状态

选择 `PATCH 更新订单状态`，Body：

```json
{ "status": "paid" }
```

验证订单状态从 `pending` 变为 `paid`。

---

### Step 5 — 验证网关代理行为

同时观察三个终端的日志，你会看到：

```
[Gateway]      [PROXY] GET /api/users → http://localhost:3001/users
[UserService]  GET /users 200 3ms
```

这证明请求确实经过了网关转发到下游服务。

---

### Step 6 — 测试错误场景

| 场景 | 操作 | 预期状态码 |
|------|------|-----------|
| 创建用户时缺少 email | POST /api/users，body 去掉 email | **400** Bad Request |
| 查询不存在的用户 | GET /api/users/00000000-... | **404** Not Found |
| 重复 email | POST /api/users，相同 email 发两次 | **409** Conflict |
| 停掉 user-service 后访问 | kill :3001 进程后 GET /api/users | **502** Bad Gateway |

---

## 六、使用技巧

### 快速复制响应字段到环境变量

在响应面板中右键某个值 → **Set Environment Variable**，可以直接把 `id` 写入 `user_id`，不需要手动复制。

### Chain Requests（请求链）

Insomnia 支持在请求 Body 中用 **Response → Body** 引用上一个请求的响应值：

1. 在 POST /api/orders 的 `userId` 字段，按 `Ctrl+Space`
2. 选择 **Response → Body**
3. 选择 `POST 创建用户` 请求，JSONPath 填 `$.id`

这样每次创建订单会自动使用最新创建的用户 ID，实现自动化流程测试。

---

## 七、与自动化测试的关系

| 工具 | 适用场景 |
|------|---------|
| **Insomnia** | 开发阶段手动探索接口，快速验证单个接口行为 |
| **e2e 测试（Jest + supertest）** | CI/CD 自动化回归，保证每次代码变更不破坏接口 |

两者互补，建议：
- 开发新接口时先用 Insomnia 调通
- 调通后将场景转化为 e2e 测试用例，纳入版本控制
