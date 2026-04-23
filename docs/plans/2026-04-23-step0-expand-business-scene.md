# 阶段零：扩充业务场景

> 日期：2026-04-23  
> 目标：为后续事务与锁的学习准备真实业务场景

---

## 目标

引入"下单扣库存"场景，让后续每个阶段都有真实的业务背景可以演示。

---

## 改造内容

### 1. 新增 `Product` 实体

```
apps/order-service/src/products/
├── entities/
│   └── product.entity.ts    # id, name, price, stock
├── dto/
│   ├── create-product.dto.ts
│   └── update-product.dto.ts
├── products.controller.ts   # CRUD 接口
├── products.service.ts      # CRUD 逻辑
└── products.module.ts
```

**`products` 表字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | 主键 |
| `name` | varchar(100) | 商品名称 |
| `price` | decimal(10,2) | 单价 |
| `stock` | int | 库存数量（核心字段，用于演示锁） |
| `createdAt` | datetime | 创建时间 |

### 2. 改造 `Order` 实体

新增 `productId` 字段，关联商品（逻辑关联，不加外键约束，保持微服务风格）。

### 3. 改造 `CreateOrderDto`

新增 `productId`（必填）和 `quantity`（购买数量，必填），用于下单时扣库存。

### 4. 改造 `OrdersService.create()`

下单逻辑变为：
```
1. 查询商品是否存在
2. 检查库存是否充足
3. 扣减库存（stock - quantity）
4. 创建订单记录
```

> ⚠️ 此阶段**故意不加事务**，为阶段一埋下伏笔——演示"没有事务时崩溃会发生什么"。

---

## Git 提交

| 字段 | 内容 |
|------|------|
| Commit | 待填写 |
| Message | `feat(order-service): 新增 Product 实体，改造 Order 关联 productId，为事务学习准备业务场景` |
