# Error Handling

> How errors are caught, logged, and returned.

---

## Overview

This project uses a **global exception filter** (`AllExceptionsFilter`) at the gateway level that normalizes all errors into a consistent response format:

```json
{
  "code": 404,
  "message": "请求的资源不存在",
  "data": null
}
```

All services should throw standard NestJS `HttpException` subclasses or let the filter handle unexpected errors.

---

## Standard HTTP Exceptions

| Status | Exception | When to use |
|--------|-----------|-------------|
| 400 | `BadRequestException` | Validation failure, invalid input |
| 401 | `UnauthorizedException` | Missing or invalid auth token |
| 403 | `ForbiddenException` | Valid auth but insufficient permissions |
| 404 | `NotFoundException` | Resource does not exist |
| 429 | `ThrottlerException` | Rate limit exceeded |
| 500 | (let filter catch) | Unexpected internal errors |

---

## Throwing Errors

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Simple case
throw new NotFoundException('订单不存在');

// With object response
throw new NotFoundException({
  message: '订单不存在',
  error: 'Not Found',
});
```

---

## AllExceptionsFilter Details

**Location**: `apps/gateway/src/filters/all-exceptions.filter.ts`

**Behavior**:
1. Catches all unhandled exceptions globally
2. For `HttpException` subclasses — extracts the status code and message
3. For validation errors (from `ValidationPipe`) — extracts the first error message
4. Maps status codes to **Chinese friendly messages** (e.g., 404 → "请求的资源不存在")
5. Logs 5xx as `error` level, 4xx as `warn` level
6. Always returns `{ code, message, data: null }`

**Status code → message map** (gateway filter):

| Code | Message |
|------|---------|
| 400 | 请求参数有误，请检查后重试 |
| 401 | 请先登录，或 Token 已过期 |
| 403 | 权限不足，无法访问该资源 |
| 404 | 请求的资源不存在 |
| 429 | 请求过于频繁，请稍后再试 |
| 500 | 服务器内部错误，请稍后再试 |
| 502 | 上游服务暂时不可用，请稍后再试 |
| 503 | 服务暂时不可用，请稍后再试 |

---

## Logging Errors

Use the NestJS built-in `Logger`:

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger('OrdersService');

this.logger.error(`Failed to create order: ${error.message}`, error.stack);
```

**Log levels**:
- `log` — 2xx success, normal operation
- `warn` — 4xx client errors, expected failures
- `error` — 5xx server errors, unexpected failures

---

## Anti-patterns

- **Do not** `console.log` — always use `Logger`
- **Do not** swallow exceptions without logging
- **Do not** expose internal error details (stack traces, DB errors) to clients — the filter strips these
- **Do not** throw raw strings — throw `HttpException` subclasses

---

## Examples

- Global exception filter: `apps/gateway/src/filters/all-exceptions.filter.ts`
- Throwing in service: `apps/order-service/src/orders/orders.service.ts`
