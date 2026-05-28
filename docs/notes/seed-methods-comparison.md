# 订单服务 Seed 方式对比

## 背景

商品表需要初始化一批种子数据。对比三种实现方式的原理、适用场景和差异。

---

## 方式一：OnModuleInit — 服务自举

### 实现

```typescript
// products-seeder.service.ts
@Injectable()
export class ProductsSeederService implements OnModuleInit {
  async onModuleInit() {
    const existing = await this.productsService.findAll();
    if (existing.length > 0) return; // 已有数据则跳过
    for (const p of SEED_PRODUCTS) {
      await this.productsService.create(p);
    }
  }
}
```

### 原理

- NestJS 模块初始化完成后会调用所有实现了 `OnModuleInit` 接口的 `onModuleInit()` 方法
- 此时数据库连接已就绪，可以直接调用 Repository
- 服务每次启动都会执行，通过"已有数据则跳过"保证幂等

### 特点

| 维度 | 说明 |
|---|---|
| 触发时机 | `npm run start:order` 时自动触发 |
| 上下文 | 完整 NestJS DI 容器，可注入任意 Service |
| INSERT 方式 | `repository.save()` — 经过实体创建流程 |
| 生命周期 | 触发 `@BeforeInsert` 等实体钩子，自动填充 `createDateColumn` |
| 依赖 | 需要完整应用启动，不适合独立运行 |
| 适用场景 | 应用自举数据（首次部署、测试数据清理后恢复） |

---

## 方式二：CLI 脚本 — Service 调用

### 实现

```typescript
// seed.ts
const dataSource = new DataSource({ type: 'mysql', entities: [Product], ... });
await dataSource.initialize();
const repo = dataSource.getRepository(Product);
const entities = SEED_PRODUCTS.map((p) => repo.create(p)); // 走 entity create
await repo.save(entities); // save() 会触发 lifecycle hook
```

### 原理

- 直接通过 `typeorm` 的 `DataSource` 连接数据库，不启动 HTTP 服务
- 使用 `repository.create()` + `repository.save()`，与 OnModuleInit 相同的实体流程
- 通过 `ts-node` 直接执行，绕过 NestJS 应用启动

### 特点

| 维度 | 说明 |
|---|---|
| 触发时机 | `npm run seed:products` 独立运行 |
| 上下文 | 无 DI 容器，直接操作 Repository |
| INSERT 方式 | `repository.save()` — 经过实体创建流程 |
| 生命周期 | 触发 `@BeforeInsert` 等实体钩子 |
| 依赖 | 仅需 TypeORM + 环境变量配置 |
| 适用场景 | 需要业务逻辑处理（如扣库存、写日志、发消息）的 seed 操作 |

---

## 方式三：CLI 脚本 — 纯 INSERT

### 实现

```typescript
// seed-sql.ts
const dataSource = new DataSource({ type: 'mysql', entities: [Product], ... });
await dataSource.initialize();
const repo = dataSource.getRepository(Product);
await repo.insert(SEED_PRODUCTS); // 直接批量 INSERT
```

### 原理

- 同样通过 `DataSource` 连接数据库，但不经过实体 `create()` 流程
- `repository.insert()` 直接生成批量 SQL `INSERT` 语句
- 不触发任何实体生命周期钩子（如 `@BeforeInsert`、`@CreateDateColumn` 自动填充）

### 特点

| 维度 | 说明 |
|---|---|
| 触发时机 | `npm run seed:products:sql` 独立运行 |
| 上下文 | 无 DI 容器，直接操作 Repository |
| INSERT 方式 | `repository.insert()` — 纯 SQL批量插入 |
| 生命周期 | **不触发** 实体钩子，`@CreateDateColumn` 需数据库 DEFAULT 或手动传入 |
| 性能 | 最高，批量 INSERT 无实体实例化开销 |
| 适用场景 | 大量数据的纯初始化，不关心实体流程 |

---

## 核心区别对比

| | OnModuleInit | seed.ts (CLI + save) | seed-sql.ts (CLI + insert) |
|---|---|---|---|
| **触发方式** | 服务启动 | npm script | npm script |
| **是否启动 HTTP** | 是 | 否 | 否 |
| **DI 容器** | 完整可用 | 无 | 无 |
| **INSERT 方式** | `save()` | `save()` | `insert()` |
| **实体生命周期钩子** | 触发 | 触发 | **不触发** |
| **`@CreateDateColumn` 自动填充** | 是 | 是 | **否**（需 DB DEFAULT） |
| **性能** | 慢（逐条 + 实体创建） | 慢（逐条 + 实体创建） | 快（批量 INSERT） |
| **适合大数据量** | 否 | 否 | 是 |
| **适用场景** | 自举数据 | 需要业务逻辑的 seed | 纯数据批量初始化 |

---

## 关键源码位置

| 文件 | 说明 |
|---|---|
| `apps/order-service/src/products/products-seeder.service.ts` | OnModuleInit 实现 |
| `apps/order-service/src/products/seed.ts` | CLI + save 实现 |
| `apps/order-service/src/products/seed-sql.ts` | CLI + insert 实现 |
| `apps/order-service/src/products/products.module.ts` | Seeder 注册 |

---

## 补充说明

### `save()` vs `insert()` 的本质区别

- `save()`：先 `create()`（实例化实体对象）→ 再 `save()`（INSERT/UPDATE）。会经过 TypeORM 实体 manager，触发所有 lifecycle hooks。

- `insert()`：直接将数据透传给 SQL `INSERT`，不创建实体实例。不触发任何 hooks，性能更好但功能更少。

### 为什么 `insert()` 不填充 `@CreateDateColumn`？

`@CreateDateColumn` 的自动填充是 TypeORM 实体 manager 在 `save()` 流程中实现的。`insert()` 绕过了这个流程，所以 `createdAt` 需要：
1. 数据库层设置 `DEFAULT CURRENT_TIMESTAMP`，或
2. 在 seed 数据中手动传入 `createdAt`

本次示例中 Product 实体的 `createdAt` 有数据库 DEFAULT，所以 insert 方式能正常工作。

---

## 命令汇总

```bash
npm run start:order        # 启动服务，OnModuleInit 自动执行 seed
npm run seed:products      # CLI 脚本，save() 方式
npm run seed:products:sql  # CLI 脚本，insert() 方式
```