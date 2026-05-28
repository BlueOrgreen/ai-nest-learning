# 数据库迁移（migrations）

SQL 迁移文件目录。完整说明见 **[docs/notes/2026-05-20-local-db-migrate-sync.md](../docs/notes/2026-05-20-local-db-migrate-sync.md)**。

## 本地同步（脚本）

```bash
pnpm migrate:local:status    # 已执行 / 待执行
pnpm migrate:local           # 执行未跑过的 *.sql
pnpm migrate:local -- --file 2026-05-20-product-management.sql
```

- 实现：`scripts/migrate-local.ts`
- 配置：`.env` + `apps/order-service/.env` 中的 `DB_*`
- 跟踪表：`_schema_migrations`（仅本地脚本使用）
- 安全：仅允许 `DB_HOST` 为 localhost / 127.0.0.1

## 线上

**不要**运行 `pnpm migrate:local`。备份后手动执行对应 `.sql`：

```bash
mysql -h <prod-host> -u <user> -p <database> < migrations/2026-05-20-product-management.sql
```

## 约定

- 命名：`YYYY-MM-DD-描述.sql`
- 已执行过的文件不要改内容；修正请新增新日期文件
- 新增 SQL → 本地 `migrate:local` → 验证 → 线上手动同文件

## 脚本索引

| 文件 | 说明 |
|------|------|
| [2026-05-20-product-management.sql](./2026-05-20-product-management.sql) | `products` 新字段 + `stock_adjustment_logs` |
| [2026-05-21-stock-adjustment-operator-user-id.sql](./2026-05-21-stock-adjustment-operator-user-id.sql) | 日志表 `operatorUserId` |

## 关联

- 同步方法与脚本详解：[docs/notes/2026-05-20-local-db-migrate-sync.md](../docs/notes/2026-05-20-local-db-migrate-sync.md)
- Unknown column 问题：[docs/notes/2026-05-20-entity-schema-mismatch.md](../docs/notes/2026-05-20-entity-schema-mismatch.md)
