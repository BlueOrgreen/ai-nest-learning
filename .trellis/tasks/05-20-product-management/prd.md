# 商品管理模块（后端 + 运营 API）

## Goal

在 `order-service` 现有商品 CRUD 与分页能力上，扩展为**可供外部管理端调用的运营向 API 套件**：领域字段增强、批量导入、库存调整与审计日志、与下单流程的业务联动。以学习 NestJS 后端实践为主，**不包含本仓库内前端页面**（管理 UI 在独立项目中对接）。

## What I already know

### 项目结构
- NestJS monorepo：`gateway` / `order-service` / `user-service` + `libs/database`、`libs/common`
- 商品代码：`apps/order-service/src/products/`
- Swagger、ValidationPipe、统一异常过滤器已在 `main.ts` 配置
- 管理端 UI：**独立项目**，通过 HTTP 调用本服务 API

### 已有能力
| 能力 | 状态 |
|------|------|
| Product 实体（id, name, price, stock, createdAt） | ✅ |
| CRUD + 分页/搜索/排序 | ✅ |
| 下单扣库存 + 事务演示 | ✅ |
| 种子数据 Seeder | ✅ WIP |

## Decision (ADR-lite)

**Context**：需在「学习广度」与「可交付 MVP」间取舍；用户另有前端项目。  
**Decision**：采用 **方案 2 — 后端深化 + 简易运营 API 套件**，不做本仓库前端。  
**Decision（批量导入）**：采用 **CSV 文件上传** — `POST /products/import` + `multipart/form-data`，便于运营 Excel 导出流程；JSON 批量接口本轮不做。  
**Decision（删除）**：采用 **软删除** — `deletedAt` + 列表默认过滤；运营以 `inactive` 下架为主，`DELETE` 用于「不再展示且需留痕」的场景。  
**Consequences**：
- 接口需稳定、契约清晰，便于跨项目联调
- 批量与日志接口要定义明确的请求/响应与错误模型
- 分类/SKU/图片等电商完整域 **本轮不做**

## Requirements

### P0 — 领域模型增强

**Product 新增字段**
| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | enum | `draft` \| `active` \| `inactive`（默认 `active`） |
| `description` | string, optional | 商品描述，最长 500 |
| `updatedAt` | datetime | 自动维护 |

**列表查询扩展**（`GET /products`）
- 新增 query：`status`（可选，单值或逗号分隔）
- 新增 query：`minStock` / `maxStock`（可选，库存区间）
- 保留现有：`page`, `pageSize`, `keyword`, `sortBy`, `sortOrder`

**业务规则**
- `inactive` 商品：**禁止创建新订单**（`OrdersService.create` 校验）
- `stock` 调整后不得为负数
- 直接 `PATCH` 改 `stock` 仍允许（兼容现有），但运营侧推荐走「库存调整」专用接口以留痕

**软删除**
- `Product` 增加 `deletedAt`（`@DeleteDateColumn`）
- `DELETE /products/:id` → 软删除（打标，HTTP 204），**不**物理删行
- `GET /products` / `GET /products/:id` 默认**排除**已删商品
- `GET /products?includeDeleted=true` 运营可查看含已删列表（仅列表接口）
- 已软删商品：`PATCH` 允许恢复字段；可提供 `POST /products/:id/restore` 清空 `deletedAt`（P1，便于运营误删恢复）
- 下单时：已删或 `inactive` 均视为不可售

### P0 — 运营 API：CSV 批量导入

```
POST /products/import
Content-Type: multipart/form-data
```

**表单字段**
| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `file` | file (.csv) | ✅ | UTF-8 CSV，首行为表头 |
| `dryRun` | query `?dryRun=true` | — | 仅校验解析与 DTO，不写库 |

**CSV 表头（列名固定，顺序不限）**
```csv
name,price,stock,status,description
珍珠奶茶,18.00,100,active,经典款
```

| 列 | 必填 | 规则 |
|----|:---:|------|
| name | ✅ | 非空，≤100 字符 |
| price | ✅ | 正数，最多 2 位小数 |
| stock | ✅ | 整数 ≥ 0 |
| status | — | 默认 `active`；允许 `draft` / `active` / `inactive` |
| description | — | ≤500 字符 |

**响应**（部分成功，HTTP 200）
```json
{
  "summary": { "total": 50, "created": 48, "failed": 2 },
  "created": [{ "id": "...", "name": "..." }],
  "errors": [{ "row": 12, "message": "price must be a positive number" }]
}
```

**行为**
- 使用 `FileInterceptor` + CSV 解析（如 `csv-parse`）
- 单次最多 **100** 行数据（不含表头）；超限返回 400
- 行级校验失败**不**中断整文件：成功行入库，失败行进入 `errors`（`row` 为 CSV 行号，含表头则从 2 起）
- 导入成功行写 `StockAdjustmentLog` 可选：`reason=batch_import` 仅当 stock>0 的初始入库场景记录一条（与 PR2 一并实现）
- 文件为空、无表头、编码非 UTF-8 → 400 明确错误

### P0 — 运营 API：库存调整 + 日志

**新实体 `StockAdjustmentLog`**
| 字段 | 说明 |
|------|------|
| id | uuid |
| productId | 关联商品 |
| delta | 变动量（正=入库，负=出库） |
| stockBefore / stockAfter | 调整前后库存 |
| reason | enum：`manual` \| `order` \| `batch_import` \| `correction` |
| remark | 可选备注 |
| createdAt | 时间 |

**接口**
```
POST   /products/:id/stock-adjustments   # 运营手工调库存
GET    /products/:id/stock-adjustments   # 分页查询日志（page, pageSize）
```

**POST body 示例**
```json
{ "delta": 10, "reason": "manual", "remark": "盘点补货" }
```

**行为**
- 事务内：读商品 → 校验 `stock + delta >= 0` → 更新 stock → 写日志
- 订单扣库存路径：在现有 `OrdersService` 扣减时 **同步写一条** `reason=order` 日志（学习点：跨 Service 协作、同事务）

### P1 — 运营 API：批量上下架

```
PATCH /products/batch-status
```

```json
{ "ids": ["uuid-1", "uuid-2"], "status": "inactive" }
```

- 返回 `{ updated: number, notFound: string[] }`

### P1 — API 文档与联调友好

- 新增/变更接口补充 `@nestjs/swagger` 装饰器（中文 summary）
- 在 `docs/practice/05-20-product-management.md` 提供 curl 示例与验收清单

## Acceptance Criteria

- [ ] `Product` 含 `status`、`description`、`updatedAt`；列表可按 status、库存区间筛选
- [ ] `POST /products/import` 接受 CSV 上传，行级部分成功，`errors[].row` 可定位
- [ ] `?dryRun=true` 时零写入，仍返回校验结果摘要
- [ ] `POST/GET .../stock-adjustments` 可用；手工调整与订单扣减均产生日志
- [ ] `inactive` 商品调用 `POST /orders` 返回明确业务错误（4xx）
- [ ] `DELETE /products/:id` 为软删除；列表默认不含已删；`includeDeleted=true` 可查出
- [ ] 已软删商品不可下单；`POST /products/:id/restore` 可恢复（P1）
- [ ] `PATCH /products/batch-status` 批量更新状态可用
- [ ] Swagger 可看到新接口；实践文档步骤可复现
- [ ] `npm run lint` / 项目 typecheck 通过

## Definition of Done

- 实现与 PRD 一致，lint / typecheck 绿
- `implement.jsonl` / `check.jsonl` 已配置 backend spec
- 实践文档 `docs/practice/05-20-product-management.md` 已写
- 有价值的新约定写入 `.trellis/spec/backend/`（Phase 3.3）

## Out of Scope

- 本仓库内任何前端 / 管理台页面
- 商品分类、SKU、规格、图片上传
- 独立商品微服务拆分
- Gateway 鉴权改造（可后续在 gateway 任务做）
- Cursor 分页、Redis 缓存、消息队列事件
- 乐观锁 `@Version`（列为进阶，本轮可选不做）

## Open Questions

*（已全部收敛）*

## Technical Notes

### 现有 API
```
GET    /products
GET    /products/:id
POST   /products
PATCH  /products/:id
DELETE /products/:id
```

### 拟新增 API 汇总
```
POST   /products/import              # CSV multipart
PATCH  /products/batch-status
POST   /products/:id/restore         # P1 恢复软删
POST   /products/:id/stock-adjustments
GET    /products/:id/stock-adjustments
```

### 本任务覆盖的学习知识点（MVP 内）
- 枚举与实体扩展、DTO 嵌套校验（`ValidateNested` + `Type`）
- 子资源路由（`/:id/stock-adjustments`）
- 事务：`dataSource.transaction` 多表写入
- 部分成功批处理与错误聚合
- 文件上传：`FileInterceptor`、`multer`、CSV 流解析
- 跨模块 Service 调用（Orders → StockAdjustment）
- Query 扩展与 QueryBuilder 动态条件
- 软删除：`@DeleteDateColumn`、`withDeleted` / 自定义 `includeDeleted`
- Swagger 契约文档

### Spec 入口
- `.trellis/spec/backend/` — directory-structure, database-guidelines, error-handling, quality-guidelines

## Research References

*（暂无；批量格式确认后如需 CSV 库选型再调研）*
