# 商品管理模块 — 实践步骤

> 任务：`.trellis/tasks/05-20-product-management`  
> 服务：`order-service`（默认端口见 `.env`，Swagger 一般为 `/api`）

## 前置

1. MySQL 已启动，`.env` 中 `DB_*` 配置正确。
2. **先同步本地表结构**：

   ```bash
   pnpm migrate:local:status
   pnpm migrate:local
   ```

   同步说明见 [docs/notes/2026-05-20-local-db-migrate-sync.md](../notes/2026-05-20-local-db-migrate-sync.md)；若报 `Unknown column`，见 [entity-schema-mismatch](../notes/2026-05-20-entity-schema-mismatch.md)。

3. 可选：本地临时 `DB_SYNCHRONIZE=true` 自动改表（仅学习；生产禁止）。
4. 启动服务：`pnpm run start:order` 或 `pnpm run dev`。

## 1. 单条 CRUD 与列表筛选

```bash
# 创建
curl -s -X POST http://localhost:3002/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"测试商品","price":19.9,"stock":50,"status":"active","description":"练习用"}'

# 列表（按状态、库存）
curl -s 'http://localhost:3002/products?status=active&minStock=1&page=1&pageSize=10'

# 详情 / 更新 / 软删
curl -s http://localhost:3002/products/<id>
curl -s -X PATCH http://localhost:3002/products/<id> -H 'Content-Type: application/json' -d '{"status":"inactive"}'
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://localhost:3002/products/<id>
```

预期：删除返回 `204`；再次 `GET` 详情为 `404`；`GET /products?includeDeleted=true` 可见已删记录。

## 2. 恢复软删

```bash
curl -s -X POST http://localhost:3002/products/<id>/restore
```

## 3. CSV 导入

```bash
# 试跑（不写库）
curl -s -X POST 'http://localhost:3002/products/import?dryRun=true' \
  -F 'file=@docs/samples/products-import.sample.csv'

# 正式导入
curl -s -X POST http://localhost:3002/products/import \
  -F 'file=@docs/samples/products-import.sample.csv'
```

预期：`summary` 含 `created` / `failed`；`errors[].row` 指向非法行（示例 CSV 第 4 行）。

## 4. 库存调整与日志

```bash
curl -s -X POST http://localhost:3002/products/stock-adjustments/<id> \
  -H 'Content-Type: application/json' \
  -d '{"delta":10,"reason":"manual","operatorUserId":"<用户UUID>","remark":"盘点补货"}'
```

需先启动 **user-service**，且 `operatorUserId` 在用户表中存在。

```bash
curl -s 'http://localhost:3002/products/stock-adjustments/<id>?page=1&pageSize=10'
```

## 5. 批量上下架

```bash
curl -s -X PATCH http://localhost:3002/products/batch-status \
  -H 'Content-Type: application/json' \
  -d '{"ids":["<uuid-1>"],"status":"inactive"}'
```

## 6. 下单联动

1. 将商品设为 `inactive` 或软删。
2. `POST /orders` 创建订单。

预期：`400`，提示不可售或已删除。

3. 对 `active` 且有库存商品下单成功后，查询 `stock-adjustments`，应有一条 `reason=order`。

## 验收清单

- [ ] 列表筛选、`includeDeleted` 正常
- [ ] CSV 导入部分成功 + `dryRun`
- [ ] 库存调整日志与订单扣减日志
- [ ] 不可售商品无法下单
- [ ] Swagger `/api` 可见新接口
