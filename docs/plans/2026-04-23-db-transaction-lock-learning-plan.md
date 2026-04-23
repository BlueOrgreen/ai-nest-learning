# 数据库事务与锁 — 学习总计划

> 日期：2026-04-23  
> 数据库：MySQL（TypeORM + NestJS）  
> 实战项目：`apps/order-service`  
> 学习风格：理解 + 编码并行，按阶段逐步推进，每阶段记录文档 + Git 提交

---

## 业务背景（贯穿所有阶段的实战场景）

```
用户下单 → 扣减商品库存 → 创建订单记录
```

涉及两张表：
- `products`（商品表，含 `stock` 库存字段）
- `orders`（订单表，含 `productId` 关联商品）

这是演示事务和锁最经典的场景：
- **没有事务**：扣库存成功但订单创建失败 → 库存凭空消失
- **没有锁**：100 个并发请求同时扣减库存 → 超卖

---

## 阶段规划

| 阶段 | 主题 | 核心问题 | 执行计划文档 | 学习笔记 |
|------|------|---------|------------|---------|
| 阶段零 | 扩充业务场景 | 新增 Product 实体，改造 Order 关联 productId | 本文件 | — |
| 阶段一 | 事务基础 | 什么是事务？ACID？TypeORM 怎么写事务？ | `step1-transaction-basics-plan.md` | `transaction-basics.md` |
| 阶段二 | 并发异常 | 脏读、不可重复读、幻读是什么？ | `step2-concurrency-anomalies-plan.md` | `concurrency-anomalies.md` |
| 阶段三 | 隔离级别 | MySQL 默认隔离级别是什么？够用吗？ | `step3-isolation-levels-plan.md` | `isolation-levels.md` |
| 阶段四 | 锁机制 | 共享锁/排他锁/死锁怎么工作？ | `step4-locks-plan.md` | `locks-shared-exclusive.md` |
| 阶段五 | 乐观锁 vs 悲观锁 | 订单状态更新用哪种锁？ | `step5-optimistic-pessimistic-plan.md` | `optimistic-vs-pessimistic.md` |

---

## 文件变更总览（完成后填写）

| 阶段 | 新增/修改文件 | Commit |
|------|-------------|--------|
| 阶段零 | Product 实体、ProductsModule、order 关联改造 | `8761af0` |
| 阶段一 | orders.service.ts（事务改造） | `1db284b` |
| 阶段二 | 演示脚本 | 待填写 |
| 阶段三 | 演示脚本 | 待填写 |
| 阶段四 | 演示脚本 | 待填写 |
| 阶段五 | Order 实体（@Version）、orders.service.ts | 待填写 |

---

## Git 提交记录

| Commit | 说明 |
|--------|------|
| 待填写 | — |
