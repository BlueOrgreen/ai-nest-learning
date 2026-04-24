# 锁机制：共享锁、排他锁与死锁

> 阶段四学习笔记 | 数据库：MySQL InnoDB | ORM：TypeORM

---

## 一、为什么需要锁？

阶段三学到：`REPEATABLE READ` 通过 MVCC 保证了**快照读**的一致性。
但快照读只是"我看到旧版本数据"，并不阻止别人修改数据。

当业务需要"**读到最新值，并且在我用完之前别人不能改**"，
就需要用锁来实现这种排他性。

**经典场景：下单扣库存**

```
库存 = 10，两个用户同时下单购买 10 件

事务 A：读到库存=10，够 → 扣减 → 库存=0
事务 B：读到库存=10，够 → 扣减 → 库存=0   ← 超卖！实际卖出了 20 件
```

没有锁，快照读各看各的，两个事务都认为"够"，同时扣减，库存变成负数。

---

## 二、MySQL InnoDB 的行锁

InnoDB 默认在**行级别**加锁，粒度小，并发性好。
（表锁会锁整张表，并发性极差，InnoDB 几乎不用表锁）

### 2.1 共享锁（S 锁，Shared Lock）

> "我要读这行，别人也可以读，但不能写"

```sql
SELECT * FROM products WHERE id = 1 LOCK IN SHARE MODE;
-- 或 MySQL 8.0+
SELECT * FROM products WHERE id = 1 FOR SHARE;
```

**特性：**
- 多个事务可以**同时持有**同一行的共享锁（读读不阻塞）
- 持有共享锁时，其他事务**不能**对该行加排他锁（读写互斥）
- 适合：读取后需要确保数据不被修改的场景（如检查余额后转账）

### 2.2 排他锁（X 锁，Exclusive Lock）

> "我要写这行，别人既不能读（当前读），也不能写"

```sql
SELECT * FROM products WHERE id = 1 FOR UPDATE;
```

**特性：**
- 同一时间只有**一个事务**可以持有排他锁
- 其他事务的 `FOR UPDATE` 和 `FOR SHARE` 都会**阻塞等待**
- 普通 `SELECT`（快照读）不受影响（MVCC 读旧版本，不需要锁）
- 适合：读后立即修改的场景（如扣库存、扣余额）

### 2.3 锁兼容矩阵

| | 无锁读 | 共享锁（FOR SHARE）| 排他锁（FOR UPDATE）|
|--|:------:|:-----------------:|:------------------:|
| **无锁读** | ✅ | ✅ | ✅ |
| **共享锁** | ✅ | ✅ | ❌ 阻塞 |
| **排他锁** | ✅（快照读）| ❌ 阻塞 | ❌ 阻塞 |

---

## 三、TypeORM 中的锁

### 3.1 QueryBuilder 加锁

```typescript
// 排他锁（FOR UPDATE）
const product = await manager
  .createQueryBuilder(Product, 'p')
  .where('p.id = :id', { id: productId })
  .setLock('pessimistic_write')   // FOR UPDATE
  .getOne();

// 共享锁（FOR SHARE）
const product = await manager
  .createQueryBuilder(Product, 'p')
  .where('p.id = :id', { id: productId })
  .setLock('pessimistic_read')    // LOCK IN SHARE MODE
  .getOne();
```

### 3.2 TypeORM 锁类型对照表

| TypeORM 参数 | SQL | 说明 |
|-------------|-----|------|
| `pessimistic_read` | `LOCK IN SHARE MODE` | 共享锁 |
| `pessimistic_write` | `FOR UPDATE` | 排他锁（最常用） |
| `optimistic` | — | 乐观锁（用版本号，阶段五讲） |
| `pessimistic_partial_write` | `FOR UPDATE SKIP LOCKED` | 跳过已锁行（队列处理场景） |
| `pessimistic_write_or_fail` | `FOR UPDATE NOWAIT` | 加锁失败立即报错（不等待） |

---

## 四、排他锁解决超卖问题

```typescript
async create(dto: CreateOrderDto): Promise<Order> {
  return this.dataSource.transaction(async (manager) => {
    // ✅ FOR UPDATE：锁定商品行，其他事务必须等待本事务完成
    const product = await manager
      .createQueryBuilder(Product, 'p')
      .where('p.id = :id', { id: dto.productId })
      .setLock('pessimistic_write')
      .getOne();

    if (!product) throw new NotFoundException('商品不存在');
    if (product.stock < dto.quantity) throw new BadRequestException('库存不足');

    // 此时其他并发事务的 FOR UPDATE 在等待，确保这里的 stock 是最新且排他的
    await manager.save(Product, { ...product, stock: product.stock - dto.quantity });

    const order = manager.create(Order, { ... });
    return manager.save(Order, order);
    // COMMIT 后，排他锁释放，等待的其他事务才能继续
  });
}
```

**并发时序：**
```
事务 A：FOR UPDATE 成功，获得锁，stock=10，扣减 → COMMIT → 锁释放，stock=0
事务 B：FOR UPDATE 阻塞等待...
                              ↑（A 提交后）
事务 B：FOR UPDATE 成功，读到 stock=0 → 库存不足 → 报错 ✅ 防止超卖
```

---

## 五、死锁（Deadlock）

### 5.1 什么是死锁？

> 两个（或多个）事务互相持有对方需要的锁，都在等待对方释放，永远无法继续。

```
事务 A：持有商品 X 的锁，等待商品 Y 的锁
事务 B：持有商品 Y 的锁，等待商品 X 的锁
         ↑ 互相等待，永久阻塞
```

### 5.2 死锁产生的条件（四个缺一不可）

1. **互斥**：锁只能被一个事务持有
2. **占有并等待**：持有锁的事务还在等其他锁
3. **不可抢占**：锁只能由持有者主动释放
4. **循环等待**：事务 A 等 B，B 等 A（形成环）

### 5.3 MySQL 如何处理死锁？

MySQL InnoDB 有**死锁检测器**（Deadlock Detector），定期检查锁等待图中是否有环。
发现死锁后，自动选择**代价最小的事务**（持有锁和修改的行数最少）进行回滚，
并抛出错误：

```
ERROR 1213 (40001): Deadlock found when trying to get lock;
try restarting transaction
```

TypeORM 中对应异常：`QueryFailedError`，`code: 'ER_LOCK_DEADLOCK'`

### 5.4 如何避免死锁？

**方法一：固定加锁顺序（最有效）**

所有事务按相同顺序请求锁，环就不会形成。

```typescript
// ✅ 总是先锁 id 小的商品，再锁 id 大的
const [idFirst, idSecond] = [productIdA, productIdB].sort();
const productFirst = await manager.findOne(Product, {
  where: { id: idFirst },
  lock: { mode: 'pessimistic_write' },
});
const productSecond = await manager.findOne(Product, {
  where: { id: idSecond },
  lock: { mode: 'pessimistic_write' },
});
```

**方法二：减小事务粒度**

事务持有锁的时间越短，死锁窗口越小。避免在事务中做耗时操作（如 HTTP 请求）。

**方法三：捕获死锁错误并重试**

```typescript
try {
  await this.dataSource.transaction(async (manager) => { ... });
} catch (err) {
  if (err?.code === 'ER_LOCK_DEADLOCK') {
    // 等待短暂时间后重试
    await sleep(100);
    return this.create(dto); // 重试
  }
  throw err;
}
```

---

## 六、锁等待超时

MySQL 默认锁等待超时：`innodb_lock_wait_timeout = 50秒`

超时后抛出：
```
ERROR 1205 (HY000): Lock wait timeout exceeded; try restarting transaction
```

TypeORM 中：`QueryFailedError`，`code: 'ER_LOCK_WAIT_TIMEOUT'`

可以通过 `FOR UPDATE NOWAIT` 立即失败而不等待：

```typescript
.setLock('pessimistic_write_or_fail') // FOR UPDATE NOWAIT
```

---

## 七、演示接口（本项目）

```
# 共享锁演示：两个请求同时读，互不阻塞
GET /orders/demo/lock/shared?productId=xxx

# 排他锁演示：第一个请求持锁 3 秒，第二个请求被阻塞
GET /orders/demo/lock/exclusive?productId=xxx

# 死锁演示：两个事务互相请求对方持有的锁
POST /orders/demo/lock/deadlock
body: { "productIdA": "xxx", "productIdB": "yyy" }
```

---

## 八、Git 提交记录

| 字段 | 内容 |
|------|------|
| Commit | 待填写 |
| 时间 | 2026-04-24 |
| Message | `feat(order-service): 阶段四 — 新增锁机制演示接口（共享锁/排他锁/死锁）` |
