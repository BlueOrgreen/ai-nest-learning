# 事务基础

> 日期：2026-04-23  
> 数据库：MySQL  
> 实战场景：order-service 下单扣库存

---

## 一、为什么需要事务？

先看一段**没有事务**的代码（当前 `OrdersService.create()` 的阶段零版本）：

```ts
// 第 3 步：扣减库存
await this.productsService.update(product.id, {
  stock: product.stock - dto.quantity,
});

// 第 4 步：创建订单  ← 如果这里抛出异常？
const order = this.ordersRepo.create({ ... });
return this.ordersRepo.save(order);  // ← 假设这里失败了
```

**问题：** 第 3 步已经执行（库存已扣），第 4 步失败（订单未创建）。

结果：
```
库存：100 → 99   ✅ 已扣减
订单：未创建      ❌ 没有记录
```

**用户付了钱，但数据库里没有订单记录。库存凭空消失。**

这就是为什么需要事务——**要么都成功，要么都不做**。

---

## 二、什么是事务？ACID

事务（Transaction）是一组操作的集合，这组操作要么**全部成功提交**，要么**全部失败回滚**。

### ACID 四个特性

| 特性 | 英文 | 含义 | 举例 |
|------|------|------|------|
| **原子性** | Atomicity | 事务内的操作不可分割，全成功或全失败 | 扣库存和建订单是一个整体，不能只做一半 |
| **一致性** | Consistency | 事务前后数据库保持业务规则的一致 | 库存不能变成负数；订单金额 = 价格 × 数量 |
| **隔离性** | Isolation | 并发事务互相不干扰（见阶段二、三） | 事务 A 扣库存时，事务 B 看到的还是原始库存 |
| **持久性** | Durability | 事务提交后，数据永久保存，即使宕机 | 订单创建成功后，重启数据库数据依然存在 |

> **记忆口诀**：原子一致隔离久（A、C、I、D）

---

## 三、MySQL 中手动操作事务

理解 TypeORM 事务之前，先看原生 SQL 怎么写：

```sql
-- 开启事务
BEGIN;

-- 扣减库存
UPDATE products SET stock = stock - 1 WHERE id = 'xxx';

-- 创建订单
INSERT INTO orders (userId, productId, quantity, amount, description)
VALUES ('user1', 'xxx', 1, 99.00, '购买商品');

-- 一切顺利，提交（数据真正写入磁盘）
COMMIT;

-- 如果中间出错，回滚（撤销所有操作）
-- ROLLBACK;
```

三个关键词：
- `BEGIN` — 开启事务（也可以写 `START TRANSACTION`）
- `COMMIT` — 提交，所有操作生效
- `ROLLBACK` — 回滚，所有操作撤销，数据恢复到 BEGIN 之前

---

## 四、TypeORM 三种事务写法

### 写法一：`dataSource.transaction()`（推荐，最简洁）

```ts
import { DataSource } from 'typeorm';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,  // 注入 DataSource
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    // transaction() 接收一个回调函数
    // 回调内的所有操作都在同一个事务中
    // 如果回调抛出异常，自动 ROLLBACK
    // 如果回调正常返回，自动 COMMIT
    return this.dataSource.transaction(async (manager) => {
      // manager 是事务专用的 EntityManager
      // 必须用 manager 操作数据库，而不是原来的 repo

      const product = await manager.findOne(Product, { where: { id: dto.productId } });
      // ... 检查库存
      await manager.save(Product, { ...product, stock: product.stock - dto.quantity });

      const order = manager.create(Order, { ... });
      return manager.save(Order, order);
    });
    // 离开 transaction() 后，TypeORM 自动 COMMIT 或 ROLLBACK
  }
}
```

**优点**：代码简洁，自动管理 COMMIT/ROLLBACK，不容易出错。  
**适用**：绝大多数场景。

---

### 写法二：`QueryRunner`（手动控制，最灵活）

```ts
async createWithQueryRunner(dto: CreateOrderDto): Promise<Order> {
  // 1. 从连接池取出一个连接
  const queryRunner = this.dataSource.createQueryRunner();

  // 2. 建立连接
  await queryRunner.connect();

  // 3. 开启事务（相当于 BEGIN）
  await queryRunner.startTransaction();

  try {
    // 4. 业务操作（用 queryRunner.manager 操作数据库）
    const product = await queryRunner.manager.findOne(Product, { ... });
    await queryRunner.manager.save(Product, { ...product, stock: product.stock - dto.quantity });
    const order = queryRunner.manager.create(Order, { ... });
    const saved = await queryRunner.manager.save(Order, order);

    // 5. 提交（相当于 COMMIT）
    await queryRunner.commitTransaction();
    return saved;
  } catch (err) {
    // 6. 出错时回滚（相当于 ROLLBACK）
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    // 7. 释放连接回连接池（无论成功失败都要执行！）
    await queryRunner.release();
  }
}
```

**优点**：可以在事务中间做额外逻辑（如记录日志、发事件），控制粒度更细。  
**缺点**：代码量多，容易忘记 `release()`。  
**适用**：需要在事务中执行非数据库操作，或需要多个 savepoint 的场景。

---

### 写法三：`@Transaction()` 装饰器（不推荐）

```ts
// 已在 TypeORM 新版中废弃，了解即可
@Transaction()
async create(@TransactionManager() manager: EntityManager, dto: CreateOrderDto) {
  // ...
}
```

**不推荐原因**：依赖装饰器魔法，调试困难；新版 TypeORM 已废弃。

---

## 五、本项目的改造：`dataSource.transaction()`

改造后的 `OrdersService.create()`：

```ts
async create(dto: CreateOrderDto): Promise<Order> {
  return this.dataSource.transaction(async (manager) => {
    // 查商品
    const product = await manager.findOne(Product, {
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException(`Product #${dto.productId} not found`);

    // 检查库存
    if (product.stock < dto.quantity) {
      throw new BadRequestException(`库存不足：当前 ${product.stock}，需要 ${dto.quantity}`);
    }

    // 扣减库存（同一事务内）
    await manager.save(Product, { ...product, stock: product.stock - dto.quantity });

    // 创建订单（同一事务内）
    const order = manager.create(Order, {
      userId: dto.userId,
      productId: dto.productId,
      quantity: dto.quantity,
      description: dto.description,
      amount: Number(product.price) * dto.quantity,
    });
    return manager.save(Order, order);
    // ← 回调正常返回 → TypeORM 自动 COMMIT
    // ← 如果上面任何一行抛异常 → TypeORM 自动 ROLLBACK
  });
}
```

---

## 六、有事务 vs 无事务对比

| | 无事务（阶段零） | 有事务（阶段一） |
|---|---|---|
| 扣库存成功、建订单失败 | 库存永久丢失 ❌ | 库存自动恢复 ✅ |
| 代码简洁度 | 简单 | 稍复杂（多了 `dataSource` 注入和 `transaction()` 包裹） |
| 数据一致性 | ❌ 无保证 | ✅ 原子操作 |

---

## 七、常见误区

**误区 1：`@InjectRepository` 的 repo 能在事务里用吗？**

❌ 不能直接用。`this.ordersRepo` 使用的是连接池的任意连接，不在当前事务中。  
✅ 必须用 `manager`（`dataSource.transaction()` 回调里的参数）或 `queryRunner.manager`。

**误区 2：事务嵌套会怎样？**

MySQL 不支持真正的嵌套事务。TypeORM 默认会复用外层事务（SAVEPOINT 机制），实际开发中避免嵌套。

**误区 3：事务一定要包裹所有操作吗？**

只读操作（SELECT）不需要事务（性能更好）；只有涉及**多个写操作需要保持一致性**时才需要。

---

## 八、Git 提交记录

| 字段 | 内容 |
|------|------|
| Commit | 待填写 |
| Message | `feat(order-service): 阶段一 — 事务包裹创建订单` |
