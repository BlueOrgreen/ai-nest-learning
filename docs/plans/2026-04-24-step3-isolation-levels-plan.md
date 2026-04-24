# 阶段三执行计划：隔离级别

## 一、目标

理解 MySQL 的 4 个隔离级别，知道每个级别解决了哪些并发异常，
并通过代码演示在不同隔离级别下切换，观察行为变化。

---

## 二、核心问题

- MySQL 默认隔离级别是什么？
- 它能防止阶段二的三种并发异常吗？
- 什么场景需要提升或降低隔离级别？

---

## 三、实现方案

在 `orders.service.ts` 新增一个 `demoIsolationLevel()` 方法，
接受隔离级别参数，用 QueryRunner 设置并展示该级别下读取数据的行为。

同时新增 `setSessionIsolationLevel()` 工具接口，
方便在测试时动态切换当前连接的隔离级别。

---

## 四、文件变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `apps/order-service/src/orders/orders.service.ts` | 修改 | 新增隔离级别演示方法 |
| `apps/order-service/src/orders/orders.controller.ts` | 修改 | 新增演示路由 |
| `docs/notes/2026-04-24-isolation-levels.md` | 新增 | 学习笔记 |
| `docs/plans/2026-04-24-step3-isolation-levels-plan.md` | 新增 | 本文件 |

---

## 五、新增接口

```
# 查询当前会话的隔离级别
GET /orders/demo/isolation-level

# 在指定隔离级别下读取商品库存（展示快照行为）
GET /orders/demo/isolation-level/read?productId=xxx&level=READ_COMMITTED
```

---

## 六、Git 提交记录

| 字段 | 内容 |
|------|------|
| Commit | 待填写 |
| 时间 | 2026-04-24 |
| Message | `feat(order-service): 阶段三 — 新增隔离级别演示接口` |
