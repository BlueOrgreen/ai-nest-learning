# Backend Quality Guidelines

> Code review standards, testing requirements, and forbidden patterns.

---

## Code Review Checklist

- [ ] Business logic lives in `*.service.ts`, not in controllers
- [ ] All API endpoints have Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)
- [ ] DTOs have validation decorators (`@IsString`, `@IsNumber`, etc.)
- [ ] Entities have explicit column types — no TypeORM inference
- [ ] Errors are thrown as `HttpException` subclasses, not raw strings
- [ ] All services use `Logger` (not `console.log`)
- [ ] No `synchronize: true` in any environment
- [ ] No database-level foreign keys between services
- [ ] Unit tests exist for service methods

---

## Testing Requirements

### Unit tests
- `*.spec.ts` files co-located with the file under test
- Use `jest` as the test runner
- Mock external dependencies (DB, downstream services)
- Test service methods in isolation

### e2e tests
- Located in `test/` at project root
- Test full request/response cycles

### Running tests

```bash
pnpm run test          # unit tests
pnpm run test:e2e     # e2e tests
pnpm run test:cov     # coverage report
```

---

## Forbidden Patterns

| Pattern | Why | Fix |
|---------|-----|-----|
| `synchronize: true` | Destroys data in production | Use migrations |
| Raw SQL strings | SQL injection risk | Use TypeORM repository |
| `console.log` | No structured logging | Use `Logger` |
| Foreign keys between services | Coupling, deployment issues | Logical associations only |
| Logic in controllers | Hard to test, violates SRP | Move to service |
| Exposing internal errors to clients | Information leakage | Let `AllExceptionsFilter` handle |

---

## Swagger Documentation

All controllers must have:
```typescript
@ApiTags('订单')           // Chinese tag
@ApiOperation({ summary: '获取所有订单' })  // Chinese summary
@ApiResponse({ status: 200, description: '订单列表' })
```

---

## TypeScript Conventions

- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- No `any` types — use proper interfaces/DTOs
- Use `export type` for unions/intersections
- Use `export interface` for object shapes

---

## Examples

- Well-tested service: `apps/order-service/src/orders/orders.service.ts`
- Swagger-decorated controller: `apps/order-service/src/orders/orders.controller.ts`
