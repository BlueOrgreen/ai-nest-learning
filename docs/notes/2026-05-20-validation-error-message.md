# 校验错误返回 DTO 具体提示

> 日期：2026-05-20

## 现象

请求体缺字段或格式错误时，接口统一返回：

```json
{
  "code": 400,
  "message": "请求参数有误，请检查后重试",
  "data": null
}
```

看不到 `class-validator` 在 DTO 上配置的 `message`。

## 根因

`libs/common` 的 `AllExceptionsFilter` 已从 `HttpException` 取出 `message`（含 ValidationPipe 的字符串数组），但下一行又用 `friendlyMap[400]` **无条件覆盖**：

```typescript
// 修复前（错误）
message = this.friendlyMap[status] ?? message;
// status=400 时永远变成「请求参数有误，请检查后重试」
```

## 修复

1. **过滤器**（`libs/common`、`apps/gateway`）：若 `message` 为具体文案（非 `Bad Request` 等 Nest 默认英文），则**保留**；否则才用友好映射。
2. **多条校验**：`message` 为数组时用 `; ` 拼接全部错误。
3. **DTO**：在装饰器上写中文 `message`，例如 `adjust-stock.dto.ts` 的 `@IsDefined({ message: '缺少必填参数 delta' })`。

## 示例

`POST /products/:id/stock-adjustments`，body 为空：

```json
{
  "code": 400,
  "message": "缺少必填参数 delta; 缺少必填参数 reason",
  "data": null
}
```

## 库存调整：reason 与 remark

`POST /products/stock-adjustments/:id` 中：

| 字段 | 类型 | 说明 |
|------|------|------|
| `reason` | 枚举 | 仅 `manual` / `order` / `batch_import` / `correction` |
| `remark` | 字符串 | 自由备注，如「修改库存 reason1」 |

错误示例（会 400）：

```json
{ "delta": 99, "reason": "修改库存reason1", "remark": "备注" }
```

正确示例：

```json
{ "delta": 99, "reason": "manual", "remark": "修改库存reason1，这是备注001" }
```

## 自定义其它 DTO

```typescript
@IsDefined({ message: '缺少必填参数 xxx' })
@IsString({ message: 'xxx 必须为字符串' })
field: string;
```

相关：[query-param-validation-fix.md](./query-param-validation-fix.md)
