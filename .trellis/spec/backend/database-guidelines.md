# Database Guidelines

> ORM patterns, queries, migrations, and naming conventions.

---

## ORM & Library

- **TypeORM** as the ORM (imported from `typeorm`)
- Synchronous migrations disabled in production (`synchronize: false`)
- All apps connect via `libs/database` shared module

---

## Entity Conventions

### File location
`src/<module>/entities/<entity-name>.entity.ts`

### Column types
Always specify explicit types — do not rely on TypeORM inference:

```typescript
@Column({ type: 'int' })
quantity: number;

@Column({ type: 'decimal', precision: 10, scale: 2 })
amount: number;

@Column({ length: 36 })
userId: string;  // UUID stored as string
```

### Primary key
Use `@PrimaryGeneratedColumn('uuid')` for UUID primary keys:

```typescript
@PrimaryGeneratedColumn('uuid')
id: string;
```

### Enums
Use TypeORM enum columns with explicit strings:

```typescript
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

@Column({
  type: 'enum',
  enum: ['pending', 'paid', 'shipped', 'completed', 'cancelled'],
  default: 'pending',
})
status: OrderStatus;
```

### Foreign keys
**No database-level foreign key constraints** between services. Cross-service data consistency is enforced at the business logic layer, not the database layer. This is intentional for the microservice architecture.

### Timestamps
Use `@CreateDateColumn()` and `@UpdateDateColumn()` for audit fields:

```typescript
@CreateDateColumn()
createdAt: Date;
```

---

## Migration Conventions

- Run migrations manually: `npm run migration:run`
- Migration files stored in `src/database/migrations/`
- Naming: `<timestamp>-<name>.ts` (e.g., `1700000000000-InitialSchema.ts`)

---

## Query Patterns

### Find operations
```typescript
// Find all, ordered
findAll(): Promise<Order[]> {
  return this.orderRepository.find({ order: { createdAt: 'DESC' } });
}

// Find by field
findByUser(userId: string): Promise<Order[]> {
  return this.orderRepository.find({ where: { userId } });
}
```

### Transactions
Use `DataSource.transaction()` for operations that span multiple tables:

```typescript
await this.dataSource.transaction(async (manager) => {
  await manager.save(Order, order);
  await manager.update(Product, { id: productId }, { stock: newStock });
});
```

---

## Anti-patterns

- **Do not** use `synchronize: true` in any environment — it destroys data
- **Do not** add foreign key constraints between services (use logical associations instead)
- **Do not** use raw SQL strings in services — use the repository pattern
- **Do not** store passwords or secrets in entities

---

## Examples

- Entity with UUID and enum: `apps/order-service/src/orders/entities/order.entity.ts`
- Database module: `libs/database/src/database.module.ts`
