# 库存调整记录操作人（operatorUserId）

> 日期：2026-05-21

## 需求

手工调库存需记录**谁操作的**，传入 `operatorUserId`，校验用户存在于 user-service，写入 `stock_adjustment_logs.operatorUserId`。

## 表结构

`migrations/2026-05-21-stock-adjustment-operator-user-id.sql`：

```sql
ALTER TABLE stock_adjustment_logs
  ADD COLUMN operatorUserId varchar(36) NULL ...
```

- 逻辑关联 `user-service` 的 `users.id`，**库级无外键**（微服务分库）
- 手工调整：必填
- 订单扣减：写入下单 `userId`
- CSV 导入：可为 `NULL`

## 接口

`POST /products/stock-adjustments/:productId`

```json
{
  "delta": 99,
  "reason": "manual",
  "operatorUserId": "用户UUID",
  "remark": "备注"
}
```

## 用户校验

`UserLookupService` → `GET {USER_SERVICE_URL}/users/:id`

- 存在：`code === 0` 且 `data.id` 有值
- 404 → `400` 用户不存在
- 连不上 user-service → `503`

配置：`USER_SERVICE_URL`（默认 `http://localhost:3001`），见 `apps/order-service/.env.example`。

## 本地迁移

```bash
pnpm migrate:local
```

## 相关代码

- [adjust-stock.dto.ts](../../apps/order-service/src/products/dto/adjust-stock.dto.ts)
- [user-lookup.service.ts](../../apps/order-service/src/products/user-lookup.service.ts)
- [stock-adjustments.service.ts](../../apps/order-service/src/products/stock-adjustments.service.ts)
