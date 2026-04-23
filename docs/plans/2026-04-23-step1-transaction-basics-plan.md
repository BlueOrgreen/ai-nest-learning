# 阶段一执行计划：事务基础

> 日期：2026-04-23

---

## 目标

理解什么是事务，掌握 TypeORM 三种事务写法，用真实代码感受"有事务 vs 无事务"的差异。

---

## 改造内容

1. `orders.service.ts` — 用 `dataSource.transaction()` 包裹"扣库存 + 建订单"
2. 新增演示方法 `createWithQueryRunner()` — 展示 `QueryRunner` 手动控制写法

---

## Git 提交

| 字段 | 内容 |
|------|------|
| Commit | `待填写` |
| 时间 | 2026-04-23 |
| Message | `feat(order-service): 阶段一 — 事务包裹创建订单，防止库存扣减与订单创建不一致` |
