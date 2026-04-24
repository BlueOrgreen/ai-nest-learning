# 阶段二执行计划：并发异常现象

## 一、目标

理解三种并发异常（脏读、不可重复读、幻读）的产生原因，
并通过代码模拟在真实数据库中复现，亲眼看到问题。

---

## 二、背景：为什么会有并发问题？

阶段一的事务解决了**单个请求的原子性**问题。
但当**两个请求同时操作同一数据**时，事务之间会互相"看见"彼此，
由此产生三种经典的并发异常：

```
并发请求 A ──────────────────────────────▶
并发请求 B ──────────────────────────────▶
                ↑ 两者交叉执行时，会出现意想不到的读写结果
```

---

## 三、三种并发异常

### 3.1 脏读（Dirty Read）
- **定义**：事务 A 读到了事务 B **尚未提交**的数据
- **危害**：事务 B 可能回滚，导致 A 读到的数据从未真正存在过
- **MySQL 默认隔离级别**（REPEATABLE READ）：**不会发生**
- **会发生的隔离级别**：READ UNCOMMITTED

```
事务 B：UPDATE products SET stock = 0  (未提交)
事务 A：SELECT stock  →  读到 0  ← 脏读！
事务 B：ROLLBACK      →  stock 恢复原值
事务 A 拿着错误的 0 去做判断，逻辑出错
```

### 3.2 不可重复读（Non-repeatable Read）
- **定义**：事务 A 在**同一事务内**两次读同一行，结果不一样
- **原因**：两次读之间，事务 B **提交了修改**
- **MySQL 默认隔离级别**：**不会发生**（REPEATABLE READ 保证同一事务内快照一致）
- **会发生的隔离级别**：READ UNCOMMITTED、READ COMMITTED

```
事务 A：SELECT stock  →  100
事务 B：UPDATE stock = 50 并 COMMIT
事务 A：SELECT stock  →  50  ← 同一事务内，两次读结果不同！
```

### 3.3 幻读（Phantom Read）
- **定义**：事务 A 在**同一事务内**两次范围查询，第二次多出了新行
- **原因**：两次查询之间，事务 B **插入了新数据并提交**
- **MySQL 默认隔离级别**：通过**间隙锁（Gap Lock）** 部分解决

```
事务 A：SELECT * FROM orders WHERE status='pending'  →  3 行
事务 B：INSERT 一条 status='pending' 的订单 并 COMMIT
事务 A：SELECT * FROM orders WHERE status='pending'  →  4 行  ← 幻读！
```

---

## 四、代码实现方案

在 `orders.service.ts` 新增三个演示方法，
每个方法用 `QueryRunner` 模拟"事务中途暂停"的场景，
通过 `sleep` 制造时间窗口让并发现象可重现。

| 方法名 | 演示现象 | 使用隔离级别 |
|--------|---------|------------|
| `demoDirtyRead()` | 脏读 | READ UNCOMMITTED |
| `demoNonRepeatableRead()` | 不可重复读 | READ COMMITTED |
| `demoPhantomRead()` | 幻读 | READ COMMITTED |

同时在 `orders.controller.ts` 新增三个 GET 接口方便触发。

> **注意**：这三个方法是**纯演示代码**，不涉及真实业务逻辑。
> 实际生产中不会这样写（sleep 占用连接）。

---

## 五、新增接口

```
GET /orders/demo/dirty-read
GET /orders/demo/non-repeatable-read
GET /orders/demo/phantom-read
```

每个接口返回两次读取的结果，直观对比差异。

---

## 六、文件变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `apps/order-service/src/orders/orders.service.ts` | 修改 | 新增三个 demo 方法 |
| `apps/order-service/src/orders/orders.controller.ts` | 修改 | 新增三个 demo 路由 |
| `docs/notes/2026-04-24-concurrency-anomalies.md` | 新增 | 学习笔记 |
| `docs/plans/2026-04-24-step2-concurrency-anomalies-plan.md` | 新增 | 本文件 |

---

## 七、Git 提交记录

| 字段　　| 内容　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　 |
| ---------| ------------------------------------------------------------------------------|
| Commit　| `6a4cfa2`　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 时间　　| 2026-04-24　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　 |
| Message | `feat(order-service): 阶段二 — 新增并发异常演示接口（脏读/不可重复读/幻读）` |
