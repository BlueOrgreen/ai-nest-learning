# brainstorm: 订单服务丰富化 - 后端

## Goal

丰富 order-service 后端能力，可能包括：新增领域逻辑（如订单超时取消、状态机）、扩展查询能力（筛选/分页/统计）、增强数据完整性（校验/幂等/补偿）、集成更多基础设施（缓存、消息、事件溯源）等。

## What I already know

### 服务结构
- `apps/order-service/` — NestJS 应用
- `src/orders/` — 订单模块（controller/service/entity/dto）
- `src/products/` — 商品模块（controller/service/entity/dto）
- `src/notification/` — BullMQ 通知队列模块

### Order 实体
- 字段：id, userId, productId, quantity, description, amount, status, createdAt
- Status 枚举：pending | paid | shipped | completed | cancelled

### 已有 API
- `GET /orders` — 全量查询（已左联 productName）
- `GET /orders/:id` — 单条查询
- `GET /orders/user/:userId` — 按用户查询
- `POST /orders` — 创建（含事务扣库存 + 队列通知）
- `PATCH /orders/:id` — 更新
- `DELETE /orders/:id` — 删除

### 已有 Demo 接口（事务学习用）
- 脏读/脏写、不可重复读、幻读、隔离级别演示、共享锁/排他锁/死锁演示

### 基础设施
- TypeORM + MySQL
- BullMQ 通知队列
- 事务：dataSource.transaction() 或 QueryRunner

### 前端
- 暂无前端项目

## Assumptions (temporary)

- 需求将逐步明确，暂时不锁定范围
- 可能涉及：订单状态机、促销/优惠券、订单履约流程、支付集成、库存Saga等

## Open Questions

- ~~你希望优先丰富哪一块业务能力？~~ → 选定：商品列表查询优化

## Requirements (evolving)

### 商品列表分页查询（优先级 P0）

**接口**
```
GET /products?page=1&pageSize=20&keyword=&sortBy=createdAt&sortOrder=desc
```

**参数**
| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| page | number | 1 | 页码（从 1 开始） |
| pageSize | number | 20 | 每页条数（最大 100） |
| keyword | string | "" | 关键词模糊搜索（搜 name） |
| sortBy | string | createdAt | 排序字段 |
| sortOrder | string | desc | 排序方向：asc / desc |

**响应**
```json
{
  "data": [...],
  "meta": { "total": 40, "page": 1, "pageSize": 20, "totalPages": 2 }
}
```

**技术方案**
- Offset 分页：`LIMIT pageSize OFFSET (page - 1) * pageSize`
- 模糊搜索：`WHERE name LIKE '%keyword%'`
- 多字段排序支持：sortBy 支持 createdAt / price / name / stock
- 性能：MySQL 主键索引，商品量级 < 10 万前无需额外优化

**设计决策**
1. 分页方式：Offset（page/pageSize）— 简单，能跳页
2. 搜索精度：模糊搜索（LIKE %keyword%）— 搜"珍珠"能匹配"珍珠奶茶"
3. 搜索字段：仅 name，后续可扩展
4. 排序默认值：createdAt DESC

**实现任务**
- [ ] 新增 `QueryProductDto`（分页 + 搜索 + 排序参数）
- [ ] 修改 `ProductsService.findAll()` → `findPaginated(dto)`，支持分页/搜索/排序
- [ ] 修改 `ProductsController.findAll()` 接收 Query 参数
- [ ] 统一响应结构 `{ data, meta }`（复用已有 TransformInterceptor）
- [ ] 单元测试

## Acceptance Criteria (evolving)

- [x] 商品表 Seed 数据初始化（OnModuleInit / CLI / SQL 三种方式）
- [ ] GET /products 支持分页、关键词搜索、多字段排序
- [ ] 响应结构含 `meta.total / page / pageSize / totalPages`
- [ ] pageSize 上限 100，防止查询过大
- [ ] Lint / typecheck / test 通过

## Definition of Done (team quality bar)

- 分页查询接口完整，响应结构符合 `{ data, meta }`
- Lint / typecheck / CI green
- 有单元测试覆盖

## Out of Scope (explicit)

- Cursor 分页（数据量 < 10 万前不需）
- MySQL FULLTEXT 索引（当前 LIKE 足够）
- 多字段搜索（仅 name）

## Technical Notes

### 订单模块
- 订单 Service：`apps/order-service/src/orders/orders.service.ts`
- 订单 Controller：`apps/order-service/src/orders/orders.controller.ts`
- 订单 Entity：`apps/order-service/src/orders/entities/order.entity.ts`

### 商品模块
- Product Entity：`apps/order-service/src/products/entities/product.entity.ts`
- Products Service：`apps/order-service/src/products/products.service.ts`
- Products Controller：`apps/order-service/src/products/products.controller.ts`
- Seed 脚本：`apps/order-service/src/products/seed-sql.ts`（SQL insert 方式）
- Seeder 服务：`apps/order-service/src/products/products-seeder.service.ts`（OnModuleInit 方式）

### Seed 三种方式对比
见 `docs/notes/seed-methods-comparison.md`