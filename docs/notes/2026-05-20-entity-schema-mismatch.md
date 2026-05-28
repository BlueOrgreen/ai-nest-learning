# Entity 与数据库表结构不一致（Unknown column）

> 日期：2026-05-20  
> 场景：商品管理模块上线后，本地 / 接口访问报错

---

## 问题现象

启动 `order-service` 或请求商品接口时，MySQL 报错：

```text
driverError: Error: Unknown column 'product.status' in 'field list'
```

Swagger / `GET /products` 等涉及 `Product` 实体的查询均可能失败。

---

## 根因

1. **代码已更新**：`Product` 实体新增了 `status`、`description`、`updatedAt`、`deletedAt`，并新增实体 `StockAdjustmentLog`。
2. **数据库未更新**：`products` 表仍是旧结构（仅有 `id, name, price, stock, createdAt` 等），没有 `status` 列。
3. **未自动同步**：`libs/database` 中 `synchronize` 由环境变量控制，默认为 `false`：

```typescript
synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
```

因此启动应用 **不会** 自动 `ALTER TABLE`，TypeORM 生成的 SQL 仍引用新字段，数据库执行即报 `Unknown column`。

这是 **Entity 与物理表结构漂移**，不是业务逻辑 bug。

---

## 解决方式

### 推荐：方式 B — 迁移 SQL + 本地同步脚本

- SQL 文件：`migrations/2026-05-20-product-management.sql`
- **本地**：`pnpm migrate:local`（脚本 `scripts/migrate-local.ts`）
- **线上**：手动执行同名 SQL，勿跑 `migrate:local`

**本地快速命令：**

```bash
pnpm migrate:local:status
pnpm migrate:local
```

**验证：**

```sql
DESCRIBE products;
SHOW TABLES LIKE 'stock_adjustment_logs';
```

执行后重启 `order-service`。

> 同步方法、脚本原理、命令表、线上流程、排错：**[2026-05-20-local-db-migrate-sync.md](./2026-05-20-local-db-migrate-sync.md)**  
> 目录速查：**[migrations/README.md](../../migrations/README.md)**

### 可选：方式 A — 仅本地开发自动同步

在 `.env` 中临时设置：

```env
DB_SYNCHRONIZE=true
```

重启 `order-service`，TypeORM 会按实体自动改表。验证通过后建议改回 `false`，避免误改结构。

---

## 线上环境注意

| 做法 | 是否推荐 |
|------|----------|
| `DB_SYNCHRONIZE=true` | ❌ 禁止。可能误删列/改类型，且与项目 spec 冲突 |
| 本地 `pnpm migrate:local` | ✅ 开发机同步表结构 |
| 线上手动执行 `migrations/*.sql` | ✅ 先备份，低峰执行，再发布新代码（勿用 migrate:local） |
| TypeORM 正式 migration 流水线 | ✅ 若团队已接入，可将同内容录入 migration 文件 |

**推荐发布顺序：**

1. 备份数据库  
2. 在预发执行 `migrations/2026-05-20-product-management.sql` 并验证  
3. 生产低峰执行同一脚本  
4. 部署含新实体代码的 order-service（`DB_SYNCHRONIZE` 保持 `false`）

若执行 `ALTER` 时报「列已存在」，说明曾开过 `synchronize` 或执行过部分脚本，用 `DESCRIBE products` 核对后只补缺失列，勿重复整段 `ALTER`。

---

## 预防

1. **改 Entity 时同步规划迁移**：新增/删列、新表 → 在 `migrations/` 增加对应 `.sql` 或 TypeORM migration。  
2. **默认 `DB_SYNCHRONIZE=false`**：开发也可用 SQL 迁移，与生产路径一致。  
3. **发布检查清单**：部署前确认目标库已执行当期 `migrations/` 脚本。  

相关文档：

- [2026-05-20-local-db-migrate-sync.md](./2026-05-20-local-db-migrate-sync.md) — 本地同步脚本完整说明
- [migrations/README.md](../../migrations/README.md) — 迁移目录速查
- `docs/practice/05-20-product-management.md` — 商品 API 实践
