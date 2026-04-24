# 并发异常现象：脏读、不可重复读、幻读

> 阶段二学习笔记 | 数据库：MySQL | ORM：TypeORM

---

## 一、为什么要学并发异常？

阶段一学的事务（ACID）解决了"单个操作的原子性"：
要么全部成功，要么全部回滚。

但**两个事务同时运行**时，它们之间会互相影响，
产生"在某一个事务内，读到了意外的数据"的问题。

这些问题统称为**并发异常**，是数据库隔离级别（下一阶段）要解决的核心问题。

---

## 二、脏读（Dirty Read）

### 2.1 定义

> 事务 A 读到了事务 B **尚未提交的修改**。

### 2.2 为什么危险？

事务 B 可能随时 ROLLBACK，那么事务 A 读到的数据从未"真实存在"过。

### 2.3 时序图

```
时间轴 ──────────────────────────────────────────▶

事务 B:  BEGIN ──→ UPDATE stock=0 ──────────────→ ROLLBACK
                                   ↑
事务 A:                            SELECT stock → 读到 0  ← 脏读！
                                                  (但实际 stock 从未变成 0)
```

### 2.4 实际危害案例

```
商品库存 stock = 10

事务 B（下单）：扣库存 stock = 0（未提交）
事务 A（统计）：读到 stock = 0，显示"已售罄"
事务 B：因支付失败 ROLLBACK，stock 恢复为 10
事务 A 已经把"售罄"结果展示给用户了 → 错误！
```

### 2.5 MySQL 中的表现

MySQL 默认隔离级别是 **REPEATABLE READ**，**不会产生脏读**。

要重现脏读，需要手动设置为 `READ UNCOMMITTED`：

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
```

### 2.6 TypeORM 代码演示

```typescript
// 事务 B：修改数据但不提交（用 sleep 制造时间窗口）
async simulateDirtyWrite(productId: string): Promise<void> {
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction('READ UNCOMMITTED');
  
  // 把库存改为 0，但故意不提交
  await qr.manager.update(Product, productId, { stock: 0 });
  
  await sleep(5000); // 等 5 秒，让事务 A 有机会来读
  
  await qr.rollbackTransaction(); // 最终回滚
  await qr.release();
}

// 事务 A：在 READ UNCOMMITTED 下读数据
async demoDirtyRead(productId: string): Promise<{ firstRead: number }> {
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction('READ UNCOMMITTED'); // 关键：使用最低隔离级别
  
  const product = await qr.manager.findOne(Product, { where: { id: productId } });
  
  await qr.commitTransaction();
  await qr.release();
  
  return { firstRead: product.stock }; // 可能读到 0（事务 B 未提交的值）
}
```

---

## 三、不可重复读（Non-repeatable Read）

### 3.1 定义

> 事务 A 在**同一事务内**对同一行数据**读了两次**，结果不同。

### 3.2 与脏读的区别

| 问题 | 读到的数据 | 对方事务状态 |
|------|-----------|------------|
| 脏读 | 未提交的数据 | 还未 COMMIT |
| 不可重复读 | 已提交的数据 | 已经 COMMIT |

### 3.3 时序图

```
时间轴 ──────────────────────────────────────────▶

事务 A:  BEGIN ──→ SELECT stock=100 ────────────→ SELECT stock=50  ← 同一事务，结果不同！
                                    ↑
事务 B:                             UPDATE stock=50 → COMMIT
```

### 3.4 实际危害案例

```
事务 A（生成订单报表）：
  第一次读：库存 100，记录到报表第一行
  ---（此时事务 B 卖出 50 件并提交）---
  第二次读：库存 50，记录到报表第二行
  报表内两行数据不一致，逻辑混乱
```

### 3.5 MySQL 中的表现

MySQL 的 REPEATABLE READ 通过 **MVCC（多版本并发控制）** 解决了不可重复读：
同一事务内，所有读操作看到的是**事务开始时的快照**，不受其他事务提交影响。

在 `READ COMMITTED` 隔离级别下会发生。

### 3.6 TypeORM 代码演示

```typescript
async demoNonRepeatableRead(productId: string): Promise<{
  firstRead: number;
  secondRead: number;
}> {
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  // READ COMMITTED：每次读都看到最新已提交数据（会产生不可重复读）
  await qr.startTransaction('READ COMMITTED');

  // 第一次读
  const p1 = await qr.manager.findOne(Product, { where: { id: productId } });
  const firstRead = p1.stock;

  // 等待期间，另一个请求修改并提交了数据
  await sleep(3000);

  // 第二次读（READ COMMITTED 下会看到其他事务已提交的修改）
  const p2 = await qr.manager.findOne(Product, { where: { id: productId } });
  const secondRead = p2.stock;

  await qr.commitTransaction();
  await qr.release();

  return { firstRead, secondRead }; // 两次结果可能不同
}
```

---

## 四、幻读（Phantom Read）

### 4.1 定义

> 事务 A 在**同一事务内**对**同一范围条件**查了两次，第二次多出了新行。

### 4.2 与不可重复读的区别

| 问题 | 影响范围 | 变化类型 |
|------|---------|---------|
| 不可重复读 | 同一行数据 | 值被修改 (UPDATE) |
| 幻读 | 一批数据 | 新增行 (INSERT) |

### 4.3 时序图

```
时间轴 ──────────────────────────────────────────▶

事务 A:  BEGIN ──→ SELECT COUNT(*)=3 ───────────→ SELECT COUNT(*)=4  ← 幻读！
                                      ↑
事务 B:                               INSERT 新订单 → COMMIT
```

### 4.4 实际危害案例

```
事务 A（检查 pending 订单总数，决定是否继续处理）：
  第一次查：3 条 pending 订单，决定批量处理
  ---（事务 B 插入了第 4 条 pending 订单）---
  第二次查：4 条，和第一次不一致，批处理逻辑出错
```

### 4.5 MySQL 中的表现

MySQL 的 REPEATABLE READ 通过**间隙锁（Gap Lock）** 阻止其他事务在"查询范围"内插入新数据，从而防止幻读。

在 `READ COMMITTED` 下会发生（没有间隙锁）。

### 4.6 TypeORM 代码演示

```typescript
async demoPhantomRead(userId: string): Promise<{
  firstCount: number;
  secondCount: number;
}> {
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction('READ COMMITTED'); // 没有间隙锁，可能幻读

  // 第一次统计
  const firstCount = await qr.manager.count(Order, {
    where: { userId, status: 'pending' },
  });

  // 等待期间，另一个请求插入了新订单
  await sleep(3000);

  // 第二次统计（READ COMMITTED 下可能多出新行）
  const secondCount = await qr.manager.count(Order, {
    where: { userId, status: 'pending' },
  });

  await qr.commitTransaction();
  await qr.release();

  return { firstCount, secondCount }; // 两次可能不同
}
```

---

## 五、三种异常对比总结

| 异常 | 操作类型 | 事务 B 状态 | 影响范围 |
|------|---------|------------|---------|
| 脏读 | 读未提交 | 未提交 | 单行值 |
| 不可重复读 | 读已提交（同一行两次不同） | 已提交 UPDATE | 单行值 |
| 幻读 | 读已提交（范围查询行数变化） | 已提交 INSERT | 多行 |

---

## 六、哪个隔离级别解决哪个问题？

（详见阶段三笔记，这里先给结论）

| 隔离级别　　　　　　　　　　　| 脏读 | 不可重复读 | 幻读　　　　　　 |
| -------------------------------| ------| ------------| ------------------|
| READ UNCOMMITTED　　　　　　　| ❌ 有 | ❌ 有　　　 | ❌ 有　　　　　　 |
| READ COMMITTED　　　　　　　　| ✅ 无 | ❌ 有　　　 | ❌ 有　　　　　　 |
| REPEATABLE READ（MySQL 默认） | ✅ 无 | ✅ 无　　　 | ⚠️ 间隙锁部分解决 |
| SERIALIZABLE　　　　　　　　　| ✅ 无 | ✅ 无　　　 | ✅ 无　　　　　　 |

---

## 七、关键结论

1. **脏读**最危险，实际生产中基本不会用 READ UNCOMMITTED
2. **不可重复读**在统计、报表类场景影响大
3. **幻读**在检查"是否存在"然后插入的场景影响大（经典：重复下单问题）
4. MySQL 默认 REPEATABLE READ 已经足够应对大多数场景

---

## 八、演示接口（本项目）

```
# 演示脏读（需要同时触发 simulateDirtyWrite）
GET /orders/demo/dirty-read?productId=xxx

# 演示不可重复读（需要同时修改数据）
GET /orders/demo/non-repeatable-read?productId=xxx

# 演示幻读（需要同时插入数据）
GET /orders/demo/phantom-read?userId=xxx
```

---

## 九、Git 提交记录

| 字段　　| 内容　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　 |
| ---------| ------------------------------------------------------------------------------|
| Commit　| `6a4cfa2`　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 时间　　| 2026-04-24　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　 |
| Message | `feat(order-service): 阶段二 — 新增并发异常演示接口（脏读/不可重复读/幻读）` |
