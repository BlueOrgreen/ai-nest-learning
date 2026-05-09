# Logging Guidelines

> Log levels, format, and what to log.

---

## Logger Usage

Use NestJS `Logger` class with the service/class name as the context:

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger('OrdersService');
```

---

## Log Levels

| Level | When to use |
|-------|-------------|
| `log` | Successful operations, routine events (2xx responses) |
| `warn` | Client errors, expected failures (4xx responses) |
| `error` | Server errors, unexpected failures, exceptions (5xx responses) |

---

## Request Logging

**Gateway-level** — two components work together:

1. **LoggerMiddleware** (`apps/gateway/src/middlewares/logger.middleware.ts`) — logs incoming requests with `x-request-id`, method, URL, response status, and duration
2. **LoggingInterceptor** (`apps/gateway/src/interceptors/logging.interceptor.ts`) — logs handler completion with class name, handler name, status code, and duration

**Format**:
```
【请求完成：Response】[req-abc123] AuthController#login → 200 +12ms
```

---

## x-request-id Header

The `RequestIdMiddleware` injects `x-request-id` into every request (using the header value if present, or generating a UUID). This ID is:
- Logged with every request/response
- Passed to downstream services via the same header
- Used for distributed tracing

---

## What to Log

**Log**:
- Request start/end with request ID
- Errors with stack traces
- Business events (order created, payment received)
- External service calls (downstream API responses)

**Do NOT log**:
- Passwords, tokens, or secrets
- Full request/response bodies for large payloads
- Personally identifiable information (PII) beyond what's necessary for debugging

---

## Service-Level Logging

Services should log:
- Errors with context: `this.logger.error(\`Failed to find order ${id}\`, error.stack)`
- Significant business events: `this.logger.log(\`Order ${order.id} created for user ${order.userId}\`)`

---

## Anti-patterns

- **Do not** use `console.log` / `console.error` — use `Logger` everywhere
- **Do not** log full user objects — log IDs and relevant fields
- **Do not** leave `Logger` calls with generic messages — include relevant context (IDs, operation names)

---

## Examples

- LoggerMiddleware: `apps/gateway/src/middlewares/logger.middleware.ts`
- LoggingInterceptor: `apps/gateway/src/interceptors/logging.interceptor.ts`
