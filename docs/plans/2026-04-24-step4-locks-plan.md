# 阶段四执行计划：锁机制

## 一、目标

理解 MySQL InnoDB 的行锁（共享锁 / 排他锁）工作原理，
能在 TypeORM 中正确使用 `SELECT ... FOR UPDATE` 防止并发超卖，
并通过代码触发死锁，理解 MySQL 如何自动检测和回滚。

---

## 二、实现方案

在 `orders.service.ts` 新增三个演示方法：

| 方法 | 演示内容 |
|------|---------|
| `demoSharedLock()` | 共享锁：两个事务同时读，互不阻塞 |
| `demoExclusiveLock()` | 排他锁：`FOR UPDATE` 锁定行，其他事务等待 |
| `demoDeadlock()` | 死锁：两个事务互相等待对方持有的锁 |

---

## 三、文件变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `apps/order-service/src/orders/orders.service.ts` | 修改 | 新增三个锁演示方法 |
| `apps/order-service/src/orders/orders.controller.ts` | 修改 | 新增三个演示路由 |
| `docs/notes/2026-04-24-locks-shared-exclusive.md` | 新增 | 学习笔记 |
| `docs/plans/2026-04-24-step4-locks-plan.md` | 新增 | 本文件 |

---

## 四、新增接口

```
GET /orders/demo/lock/shared?productId=xxx        # 共享锁演示
GET /orders/demo/lock/exclusive?productId=xxx     # 排他锁演示（需并发触发）
POST /orders/demo/lock/deadlock                   # 死锁演示
body: { "productIdA": "xxx", "productIdB": "yyy" }
```

---

## 五、Git 提交记录

| 字段 | 内容 |
|------|------|
| Commit | `60a40f5` |
| 时间 | 2026-04-24 |
| Message | `feat(order-service): 阶段四 — 新增锁机制演示接口（共享锁/排他锁/死锁）` |
