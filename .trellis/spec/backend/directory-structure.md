# Backend Directory Structure

> How backend code is organized in this project.

---

## Overview

NestJS monorepo using `@nestjs/core` with a modular architecture. Each app is an independent deployable unit; libs are shared code.

---

## Directory Layout

```
.
├── apps/
│   ├── gateway/          # API Gateway — entry point, auth, proxy, rate limiting
│   │   └── src/
│   │       ├── auth/         # JWT authentication & role guards
│   │       ├── middlewares/  # RequestIdMiddleware, LoggerMiddleware
│   │       ├── filters/      # AllExceptionsFilter
│   │       ├── interceptors/ # LoggingInterceptor, TransformInterceptor
│   │       ├── proxy/        # ProxyService for forwarding to downstream services
│   │       ├── resilience/   # Resilience4j patterns (retry, circuit breaker)
│   │       ├── decorators/   # Custom decorators (e.g., @Roles)
│   │       ├── config/       # Gateway-level configuration
│   │       └── main.ts
│   │
│   ├── order-service/    # Order management service
│   │   └── src/
│   │       ├── orders/       # Orders module (controller, service, entities, dto)
│   │       ├── products/     # Products module
│   │       ├── notification/ # Notification module
│   │       ├── health/       # Health check endpoint
│   │       └── main.ts
│   │
│   └── user-service/    # User management service
│       └── src/
│           └── ...
│
├── libs/
│   ├── database/         # TypeORM setup, health check
│   │   └── src/
│   │       ├── database.module.ts
│   │       └── database.health.ts
│   │
│   └── common/           # Shared filters, interceptors (gateway-only currently)
│       └── src/
│           ├── filters/
│           └── interceptors/
│
└── test/                  # e2e tests
```

---

## Module Organization

Each NestJS module follows the same pattern:

```
module-name/
├── dto/                  # Data Transfer Objects
│   ├── create-xxx.dto.ts
│   └── update-xxx.dto.ts
├── entities/             # TypeORM entities
│   └── xxx.entity.ts
├── xxx.controller.ts     # REST endpoints
├── xxx.service.ts        # Business logic
├── xxx.module.ts         # Module definition
└── xxx.controller.spec.ts # Unit tests
```

**Key rules**:
- Business logic lives in `*.service.ts`, not in controllers
- DTOs are decorated with Swagger decorators (`@ApiProperty`, `@ApiResponse`)
- Entities use TypeORM decorators with explicit column types
- No logic in controllers — only parameter parsing and delegation

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Module directory | kebab-case | `order-service/src/orders/` |
| Entity class | PascalCase singular | `Order` |
| DTO class | PascalCase with suffix | `CreateOrderDto`, `UpdateOrderDto` |
| Service class | PascalCase with suffix | `OrdersService` |
| Controller class | PascalCase with suffix | `OrdersController` |
| File names | kebab-case | `orders.controller.ts` |
| Database table | singular snake_case | `orders` |

---

## API Route Conventions

- All routes use kebab-case: `/orders`, `/order-items`
- Controller routes use `@Controller('orders')` and method decorators
- Swagger tags are Chinese: `@ApiTags('订单')`
- Swagger summaries are Chinese: `@ApiOperation({ summary: '获取所有订单' })`

---

## Examples

- Best-organized module: `apps/order-service/src/orders/` — complete CRUD, DTOs, entity, Swagger decorators
- Gateway middleware chain: `apps/gateway/src/app.module.ts` — shows middleware registration order
