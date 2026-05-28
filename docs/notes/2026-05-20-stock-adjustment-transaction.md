# 库存调整为什么用事务（stock-adjustments.service）

> 日期：2026-05-20  
> 代码：`apps/order-service/src/products/stock-adjustments.service.ts`

---

## 问题

`adjust()` 里为什么要用 `this.productsRepo.manager.transaction(...)`，而不是直接 `save`？

```typescript
async adjust(productId: string, dto: AdjustStockDto) {
  return this.productsRepo.manager.transaction(async (manager) => {
    const product = await this.findActiveProduct(manager, productId);
    return this.applyDelta(manager, product, dto.delta, dto.reason, dto.remark);
  });
}
```

---

## 解答

### 一次调库存实际做了两步写库

在 `recordWithManager` 中，同一逻辑事务内连续操作 **两张表**：

| 顺序 | 操作 | 表 |
|------|------|-----|
| 1 | 更新 `product.stock` | `products` |
| 2 | 插入一条审计记录（`stockBefore` / `stockAfter` / `delta` / `reason` / `remark`） | `stock_adjustment_logs` |

```typescript
product.stock = stockAfter;
await manager.save(Product, product);

const log = manager.create(StockAdjustmentLog, { ... });
return manager.save(StockAdjustmentLog, log);
```

### 事务要解决的问题：原子性

若 **不用事务**：

| 失败点 | 后果 |
|--------|------|
| 库存更新成功，日志插入失败 | 库存已变，**没有日志** → 运营对账、追溯困难 |
| 日志插入成功，库存更新失败 | 有日志但库存未变 → 数据自相矛盾 |
| 校验抛错（如 `stockAfter < 0`）发生在两步之间 | 可能只执行了其中一步 |

使用 `manager.transaction()` 后：

- 两步都成功 → **COMMIT**
- 任一步抛错 → **ROLLBACK**，`products` 与 `stock_adjustment_logs` 都回到调用前状态

业务要求：**当前库存数字** 与 **调整日志** 必须一致，因此需要「要么都成功，要么都失败」。

### 为什么传入 `manager`，而不是 `this.productsRepo.save()`

`recordWithManager(manager, ...)` 强制所有读写走 **同一个 `EntityManager`（事务上下文）**：

- `adjust()` 自己开启的事务能包住「查商品 → 改库存 → 写日志」
- `OrdersService.create()` 在 **订单事务** 里调用同一个方法时，扣库存、写 `reason=order` 日志与创建订单可在 **同一事务** 中提交或回滚

若在事务外使用 `this.productsRepo.save()`，写入会落在默认连接上，**不参与**外层事务，破坏原子性。

### 和订单扣库存的关系

下单路径（简化）：

```
BEGIN
  查 Product → 校验可售 / 库存
  recordWithManager(..., delta: -quantity, reason: 'order')  // 改 stock + 写日志
  创建 Order
COMMIT / ROLLBACK
```

手工调库存路径：

```
BEGIN
  查 Product
  recordWithManager(..., reason: 'manual' 等)
COMMIT / ROLLBACK
```

两处复用 `recordWithManager`，保证「改库存 + 记日志」规则一致。

### 不用事务可以吗？

- 只更新一张表、且无关联副作用时，事务价值较小。
- 当前设计是 **库存变更必须留痕**（`stock_adjustment_logs`），两步写库绑在一起，用事务是常规且合理的做法。

---

## 一句话总结

`transaction` 保证 **改 `products.stock`** 与 **插入 `stock_adjustment_logs`** 同时生效，避免「库存已改无日志」或「有日志库存未改」的不一致；并支持与订单创建共用同一事务上下文。

---

## 相关

- 实现：[stock-adjustments.service.ts](../../apps/order-service/src/products/stock-adjustments.service.ts)
- 订单内调用：[orders.service.ts](../../apps/order-service/src/orders/orders.service.ts) `create()` / `createWithQueryRunner()`
- 事务基础笔记：[2026-04-23-transaction-basics.md](./2026-04-23-transaction-basics.md)
- `reason` / `remark` 字段说明：[2026-05-20-validation-error-message.md](./2026-05-20-validation-error-message.md)
