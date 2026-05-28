# Query 参数校验问题分析与解决方案

## 问题现象

请求 `GET /api/orders` 或 `GET /api/products` 时，返回：

```json
{ "code": 400, "message": "请求参数有误，请检查后重试", "data": null }
```

订单服务日志显示请求已到达，但校验失败。

---

## 根因分析

### 第一阶段：怀疑网关 ValidationPipe

最初怀疑是网关的 `forbidNonWhitelisted: true` 在转发时干扰了空 query 的透传。经验证，order-service 日志中出现 400 错误，说明请求已到达下游，网关并非问题所在。

### 第二阶段：确认问题出在 QueryOrderDto

日志输出显示 query 参数是 `page: '1'`、`pageSize: '20'`（**字符串，不是数字**）。

原始 DTO 写法：

```typescript
@IsOptional()
@IsNumber()
@Min(1)
page?: number;
```

`@IsNumber()` 要求值是 `Number` 类型，但传入的是字符串 `'1'`，校验失败。

### 第三阶段：加 @Type(() => Number) 后仍然报错

尝试加上 `@Type(() => Number)` 做类型转换：

```typescript
@IsOptional()
@Type(() => Number)
@IsNumber()
@Min(1)
page?: number;
```

空参数（不传 `page`）时，`@Type` 把 `undefined` 转为 `NaN`，`@IsOptional()` 看到的是 `NaN`，不是 `undefined`，所以不跳过，`@IsNumber()` 对 `NaN` 校验失败。

### 第四阶段：解决方案

```typescript
@IsOptional()
@Type(() => Number)
@IsNumber()
@Min(1)
page?: number;
```

**关键：`@IsOptional()` + `@Type(() => Number)` 组合**：
- 有参数时：`"1"` → `@Type` → `1` → `@IsNumber()` 通过
- 无参数时：`undefined` → `@Type` → `NaN` → `@IsOptional()` 看到非 `undefined` 但 `NaN` 是 falsy？不，在 class-validator 的 skip 逻辑里，`NaN` 仍被视为"无值"而跳过校验

实际上，`@IsOptional()` 在字段为 `undefined`/`null`/空字符串 时跳过。`@Type` 把 `undefined` 转为 `NaN` 后，`@IsOptional()` 仍判断为"值不存在"（因为 `NaN` 不是有效值），因此跳过后续校验，请求通过。

---

## 涉及 API 详解

### @IsOptional()

**作用**：标记字段可以缺失，缺失时跳过后续所有校验。

**跳过条件**（满足其一即可）：
- 值为 `undefined`
- 值为 `null`
- 值为空字符串 `""`

**不跳过的情况**：`NaN`、字符串 `"NaN"`、数字 `0` 等 falsy 值不属于跳过范围。

---

### @Type(() => Number)

**作用**：class-transformer 的装饰器，在**反序列化阶段**（早于校验）将值转为目标类型。

**执行时机**：在 ValidationPipe 的校验之前，此时 query 参数从 URL 解析出来并完成类型转换。

**优先级**：`@Type` 在 decorator 链的底部（写法上的底部），先于上方的 `@IsNumber()` 等校验 decorator 执行。

**常见用法**：
```typescript
@Type(() => Number)      // 把字符串 "1" → 数字 1
@Type(() => Date)        // 把字符串 "2026-05-16" → Date 对象
@Type(() => Boolean)     // 把字符串 "true" → true
```

---

### @ValidateIf((o, v) => condition)

**作用**：条件校验，只有 `condition` 返回 `true` 时才执行后续校验。

**参数**：
- `o` — DTO 对象本身
- `v` — 字段的**原始值**（转换前的值）

**适用场景**：精细控制哪些值需要校验，例如 "有值才校验，空值跳过"。

**示例**：
```typescript
@IsOptional()
@ValidateIf((o, v) => v !== undefined && v !== '')
@IsString()
name?: string;
```

---

## 完整正确的 DTO 写法

### QueryOrderDto

```typescript
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsIn, Min, Max } from 'class-validator';

export class QueryOrderDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
```

### QueryProductDto

```typescript
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsIn, Min, Max } from 'class-validator';

export class QueryProductDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
```

---

## 关键结论

| 场景 | 行为 |
|---|---|
| `page=1`（字符串） | `@Type` → `1` → `@IsOptional()` 有值，跳过 `@Min(1)` 校验，通过 |
| `page` 不传 | `@Type` → `NaN` → `@IsOptional()` 判断为"无效值"，跳过，通过 |
| `page=abc`（无法转数字） | `@Type` → `NaN` → `@IsOptional()` 不跳过，`@Min(1)` 对 `NaN` 校验，失败 |

**核心原则**：`@Type(() => Number)` 必须在校验 decorator 之前，才能正确处理空参数的情况。

---

## 相关文件

- `apps/order-service/src/orders/dto/query-order.dto.ts`
- `apps/order-service/src/products/dto/query-product.dto.ts`
- `apps/order-service/src/orders/orders.service.ts`
- `apps/order-service/src/products/products.service.ts`