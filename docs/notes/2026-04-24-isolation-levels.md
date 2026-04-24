# 事务隔离级别

> 阶段三学习笔记 | 数据库：MySQL | ORM：TypeORM

---

## 一、为什么需要隔离级别？

阶段二看到了三种并发异常：脏读、不可重复读、幻读。
这三种异常**都是"隔离不够"导致的**——事务之间互相看到了不该看到的数据。

但隔离越强，性能越差（需要更多的锁和等待）。
所以 SQL 标准定义了 **4 个隔离级别**，让开发者根据业务需要做权衡。

---

## 二、4 个隔离级别

按隔离强度从低到高：

### 2.1 READ UNCOMMITTED（读未提交）

> 最低隔离级别，几乎不做任何隔离

- 可以读取其他事务**尚未提交**的数据
- 会产生：**脏读 ✅ 不可重复读 ✅ 幻读 ✅**（三种异常全有）
- 实际使用：**几乎不用**，只在对准确性要求极低的统计场景偶尔出现

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
```

### 2.2 READ COMMITTED（读已提交）

> 只能读取**已提交**的数据，解决了脏读

- 每次读取都看到最新的已提交快照
- 会产生：**不可重复读 ✅ 幻读 ✅**
- 实际使用：**PostgreSQL 的默认级别**；很多互联网公司也把 MySQL 改为此级别（性能更好）

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

**为什么会有不可重复读？**

READ COMMITTED 的快照是"每次语句执行时"建立的，
所以同一事务内两次 SELECT，如果中间有别人提交了修改，第二次就会看到新值。

### 2.3 REPEATABLE READ（可重复读）—— MySQL 默认

> 同一事务内，多次读取同一行，结果一致

- 事务开始时建立快照，事务内所有读都基于这个快照（MVCC）
- 通过**间隙锁（Gap Lock）** 阻止范围内的新插入，部分解决幻读
- 会产生：**幻读（极端情况下，当前读场景）⚠️**
- 实际使用：**MySQL InnoDB 的默认级别，通常够用**

```sql
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- 或查看当前级别
SELECT @@transaction_isolation;
```

**MVCC 快照读 vs 当前读**

| 读类型 | 触发方式 | 看到的数据 |
|--------|---------|----------|
| 快照读（Snapshot Read）| 普通 `SELECT` | 事务开始时的快照，不受其他事务影响 |
| 当前读（Current Read）| `SELECT ... FOR UPDATE` / `UPDATE` / `DELETE` | 最新已提交数据，会加锁 |

> **重要**：`REPEATABLE READ` 只保证**快照读**的一致性。
> 如果在事务中使用 `SELECT ... FOR UPDATE`（当前读），
> 仍然可能看到其他事务插入的新行（幻读）。
> 这就是为什么 MySQL 还需要**间隙锁**来补充防护。

### 2.4 SERIALIZABLE（串行化）

> 最高隔离级别，事务完全串行执行

- 所有读操作自动加共享锁，所有写操作自动加排他锁
- 不存在任何并发异常
- 会产生：**无并发异常**，但并发性能极低
- 实际使用：金融核心账务、对账等对准确性要求极高的场景

```sql
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

---

## 三、四个级别对比总结

| 隔离级别　　　　 | 脏读 | 不可重复读 | 幻读　　　 | 性能　| 适用场景　　　　　　　　 |
| ------------------| :----:| :----------:| :----------:| :-----:| --------------------------|
| READ UNCOMMITTED | ❌ 有 | ❌ 有　　　 | ❌ 有　　　 | ⭐⭐⭐⭐⭐ | 极少使用　　　　　　　　 |
| READ COMMITTED　 | ✅ 无 | ❌ 有　　　 | ❌ 有　　　 | ⭐⭐⭐⭐　| 互联网常用　　　　　　　 |
| REPEATABLE READ　| ✅ 无 | ✅ 无　　　 | ⚠️ 部分解决 | ⭐⭐⭐　 | **MySQL 默认，通常够用** |
| SERIALIZABLE　　 | ✅ 无 | ✅ 无　　　 | ✅ 无　　　 | ⭐　　 | 金融核心场景　　　　　　 |

---

## 四、MySQL 默认隔离级别够用吗？

**结论：大多数场景够用。**

MySQL InnoDB 的 `REPEATABLE READ` 通过两个机制联合防护：

1. **MVCC（多版本并发控制）**：保证快照读的一致性，解决不可重复读
2. **间隙锁（Gap Lock）**：锁定范围，阻止其他事务在范围内插入，解决大部分幻读

**什么时候需要升级到 SERIALIZABLE？**

当业务逻辑需要"检查后操作"的严格串行化，且无法通过应用层加锁解决时。
但通常用**悲观锁**（`SELECT ... FOR UPDATE`）替代，性能更好（阶段五会讲）。

---

## 五、TypeORM 中如何设置隔离级别？

### 方式一：`dataSource.transaction()` 指定级别

```typescript
await this.dataSource.transaction(
  'READ COMMITTED', // 第一个参数指定隔离级别
  async (manager) => {
    // 事务内操作
  },
);
```

### 方式二：`QueryRunner.startTransaction()` 指定级别

```typescript
const qr = this.dataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction('SERIALIZABLE'); // 指定级别

try {
  // 业务操作
  await qr.commitTransaction();
} catch (err) {
  await qr.rollbackTransaction();
  throw err;
} finally {
  await qr.release();
}
```

### 方式三：查询当前会话的隔离级别

```typescript
const result = await this.dataSource.query(
  "SELECT @@transaction_isolation AS level",
);
// result[0].level => 'REPEATABLE-READ'
```

### TypeORM 支持的隔离级别字符串

```typescript
type IsolationLevel =
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';
```

---

## 六、结合项目的最佳实践

### order-service 的下单场景

```typescript
// 当前写法（REPEATABLE READ，MySQL 默认）
await this.dataSource.transaction(async (manager) => {
  // 查库存 → 扣库存 → 建订单
});

// 如果有并发超卖风险，升级为悲观锁（阶段五）：
await this.dataSource.transaction(async (manager) => {
  // SELECT ... FOR UPDATE 锁住商品行
  const product = await manager
    .createQueryBuilder(Product, 'p')
    .setLock('pessimistic_write')
    .where('p.id = :id', { id: productId })
    .getOne();
  // 此时其他事务无法修改这行，安全扣减
});
```

### 隔离级别选择决策树

```
业务场景
  ├── 只读统计（允许轻微误差）→ READ COMMITTED（性能更好）
  ├── 常规增删改查           → REPEATABLE READ（MySQL 默认）
  ├── 有并发写冲突风险       → REPEATABLE READ + 悲观锁/乐观锁
  └── 严格串行（金融对账）   → SERIALIZABLE 或 应用层分布式锁
```

---

## 七、演示接口（本项目）

```
# 查看当前 MySQL 会话的隔离级别
GET /orders/demo/isolation-level

# 在不同隔离级别下读取商品库存，观察快照行为
GET /orders/demo/isolation-level/read?productId=xxx&level=READ_COMMITTED
GET /orders/demo/isolation-level/read?productId=xxx&level=REPEATABLE_READ
```

---

## 八、Git 提交记录

| 字段 | 内容 |
|------|------|
| Commit | `dde7e70` |
| 时间 | 2026-04-24 |
| Message | `feat(order-service): 阶段三 — 新增隔离级别演示接口` |
