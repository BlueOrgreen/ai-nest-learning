# 本地数据库迁移同步（migrations + migrate-local）

> 日期：2026-05-20  
> 适用：开发机同步 `migrations/*.sql` 到本地 MySQL；线上单独手动执行 SQL

---

## 1. 整体设计

| 角色 | 做什么 |
|------|--------|
| **SQL 文件** | `migrations/<日期>-<描述>.sql`，描述表结构变更，可版本管理、可审阅 |
| **本地同步脚本** | `scripts/migrate-local.ts`，只连本地库，按顺序执行「未跑过」的 `.sql` |
| **线上** | **不用脚本**，在备份后由 DBA / 运维用客户端或 `mysql` 手动执行**同名** `.sql` |

原则：**代码改 Entity → 新增 SQL → 本地 `pnpm migrate:local` → 验证 → 线上手动跑同一文件**。

```
migrations/*.sql
       │
       ├─► 本地: pnpm migrate:local  ──► MySQL + _schema_migrations
       │
       └─► 线上: mysql / DBA 工具手动执行（不跑 migrate:local）
```

---

## 2. 目录与脚本

| 路径 | 说明 |
|------|------|
| `migrations/` | 所有 `.sql` 迁移文件 |
| `migrations/README.md` | 目录约定与命令速查 |
| `scripts/migrate-local.ts` | 本地同步入口 |
| `scripts/load-env.ts` | 读取 `.env`、`apps/order-service/.env` |

`package.json` 中注册的命令：

| 命令 | 等价 | 作用 |
|------|------|------|
| `pnpm migrate:local` | `ts-node scripts/migrate-local.ts` | 执行所有**待执行**的 `.sql` |
| `pnpm migrate:local:status` | 加参数 `-- --status` | 只打印已执行 / 待执行列表，不改库 |
| `pnpm migrate:local -- --file <文件名>` | 指定单个文件 | 仅当该文件**未记录**时执行 |

---

## 3. 本地同步方法（推荐流程）

### 3.1 配置

确保项目根目录或 `apps/order-service/.env` 中数据库配置正确（与 `order-service` 一致）：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=你的密码
DB_DATABASE=nest_order_service
```

`DB_SYNCHRONIZE` 保持 `false`（默认），表结构由迁移脚本维护，不与 TypeORM 自动同步混用。

### 3.2 执行

在项目根目录：

```bash
# 1. 查看状态
pnpm migrate:local:status

# 2. 执行待执行的迁移
pnpm migrate:local

# 3. 重启 order-service（若已在跑）
#    pnpm run dev 中重启 order-service 进程即可
```

### 3.3 验证

```sql
DESCRIBE products;
SHOW TABLES LIKE 'stock_adjustment_logs';
SELECT * FROM _schema_migrations;
```

接口侧可再访问 `GET /products` 或 Swagger，确认不再出现 `Unknown column`。

### 3.4 只跑某一个文件

```bash
pnpm migrate:local -- --file 2026-05-20-product-management.sql
```

若该文件已在 `_schema_migrations` 中登记，脚本会提示已执行并跳过。

---

## 4. 同步脚本行为说明

`scripts/migrate-local.ts` 执行顺序：

1. **加载环境变量**  
   顺序：`.env` → `apps/order-service/.env`（后者覆盖前者）。

2. **安全检查**  
   `DB_HOST` 必须是 `localhost`、`127.0.0.1` 或 `::1`。  
   否则退出，避免误连线上。若确需在非本地主机跑脚本（不推荐），需设置 `ALLOW_REMOTE_MIGRATE=true`。

3. **扫描** `migrations/` 下所有 `.sql`，按**文件名排序**。

4. **跟踪表** `_schema_migrations`  
   - 不存在则自动 `CREATE TABLE`  
   - 字段：`filename`（唯一）、`applied_at`  
   - 已登记的 `.sql` 不会再次执行

5. **执行单个文件**  
   - 读取整文件，使用 `multipleStatements: true` 一次提交  
   - **单文件一个事务**：成功则 `COMMIT` 并 `INSERT` 跟踪记录；失败则 `ROLLBACK`，不登记

6. **输出**  
   打印目标库 `user@host:port/database`、已执行数、待执行数及每个文件名。

### 与「手写 mysql」的区别

| 方式 | 重复执行同一 SQL | 记录已执行 |
|------|------------------|------------|
| `pnpm migrate:local` | 自动跳过已登记文件 | `_schema_migrations` |
| `mysql < file.sql` | 可能报 Duplicate column | 无，需自行记录 |

本地开发推荐脚本；需要与线上一致、不依赖跟踪表时，仍可用：

```bash
mysql -h 127.0.0.1 -u root -p nest_order_service < migrations/2026-05-20-product-management.sql
```

---

## 5. 线上环境做法

1. **禁止**在生产库执行 `pnpm migrate:local`。  
2. **不要**在生产开 `DB_SYNCHRONIZE=true`。  
3. 发布前：**备份** → 低峰窗口 → 在预发/生产执行与本地**相同**的 `migrations/xxx.sql`：

```bash
mysql -h <prod-host> -u <user> -p <database> < migrations/2026-05-20-product-management.sql
```

4. 线上可以不建 `_schema_migrations`；由发布单记录「已于某日执行 xxx.sql」。  
5. 再部署包含新 Entity 的应用版本。

---

## 6. 新增迁移时的操作清单

1. 在 `migrations/` 新增 `YYYY-MM-DD-描述.sql`（勿修改已执行过的旧文件内容）。  
2. 本地：`pnpm migrate:local:status` → `pnpm migrate:local`。  
3. 跑服务 / 测试接口。  
4. 提交 Git：`migrations/` + 如有代码变更。  
5. 上线：运维按同名 SQL 手动执行，再发版。

---

## 7. 常见问题

### Q: `Unknown column 'product.status'`

Entity 已更新，库表未迁移。执行 `pnpm migrate:local` 或阅读 [2026-05-20-entity-schema-mismatch.md](./2026-05-20-entity-schema-mismatch.md)。

### Q: `Duplicate column name 'status'`

说明表已部分迁移。`DESCRIBE products` 对照实体，只补缺失列，或新建**新日期**的补丁 `.sql`，不要重复跑整份旧脚本。若本地误登记，可删跟踪表记录后只跑补丁（谨慎）：

```sql
-- 仅当你确认该 SQL 未真正执行成功、却要重跑时
DELETE FROM _schema_migrations WHERE filename = '2026-05-20-product-management.sql';
```

### Q: 脚本提示拒绝非本地 `DB_HOST`

故意设计。线上请用手动 SQL，不要设 `ALLOW_REMOTE_MIGRATE` 对生产库跑脚本。

### Q: 迁移成功但接口仍报错

重启 `order-service`；确认连的是执行迁移的同一 `DB_DATABASE`。

---

## 8. 相关文档

| 文档 | 内容 |
|------|------|
| [migrations/README.md](../../migrations/README.md) | 迁移目录速查 |
| [2026-05-20-entity-schema-mismatch.md](./2026-05-20-entity-schema-mismatch.md) | Unknown column 问题与根因 |
| [docs/practice/05-20-product-management.md](../practice/05-20-product-management.md) | 商品模块 API 实践 |
