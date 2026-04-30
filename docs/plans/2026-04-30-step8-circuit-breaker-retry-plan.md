# Step 8: 熔断与重试实现方案

**日期：** 2026-04-30  
**项目：** my-firstnest  
**目标：** 在网关中实现熔断器 (Circuit Breaker) 和请求重试 (Retry) 机制

---

## 一、整体设计

### 1.1 架构图

```
客户端请求
  → ProxyController
  → ProxyService.forward()
      → ResilienceService.checkCircuitBreaker()  # 检查熔断状态
          ↓ 熔断开启 → 执行降级策略 → 返回 503 / 降级响应
          ↓ 熔断关闭 → 转发请求
              → HttpService (已配置 axios-retry)
                  → 下游服务 (user-service:3001 / order-service:3002)
              → ResilienceService.recordResult()  # 记录成功/失败
  → 返回响应
```

### 1.2 技术组件

| 组件 | 用途 | 实现方式 |
|------|------|----------|
| ResilienceModule | 熔断器管理模块 | 新创建 |
| CircuitBreakerService | 熔断器实例管理 | 基于 opossum |
| RetryInterceptor | HTTP 重试配置 | 基于 axios-retry |
| FallbackService | 降级响应生成 | 新创建 |

---

## 二、详细实现步骤

### 步骤 1: 安装依赖

```bash
pnpm add opossum axios-retry
pnpm add -D @types/opossum
```

### 步骤 2: 创建 ResilienceModule 及相关文件

```
apps/gateway/src/resilience/
├── resilience.module.ts          # 模块定义
├── circuit-breaker.service.ts    # 熔断器管理
├── fallback.service.ts           # 降级响应
├── constants/                    # 常量定义
│   └── resilience.constants.ts
├── interfaces/                   # 类型定义
│   └── circuit-breaker.interface.ts
└── decorators/                   # 装饰器（可选）
    └── circuit-breaker.decorator.ts
```

### 步骤 3: 配置熔断器参数

在 `circuit-breaker.service.ts` 中定义默认配置：

```typescript
const DEFAULT_CIRCUIT_BREAKER_OPTIONS = {
  timeout: 5000,           // 5秒超时
  errorThresholdPercentage: 50, // 错误率超过50%触发熔断
  resetTimeout: 30000,     // 30秒后进入半开状态
  rollingCountTimeout: 10000, // 10秒滑动窗口
  rollingCountBuckets: 10, // 10个桶统计
  name: 'default',         // 熔断器名称
};
```

### 步骤 4: 实现 CircuitBreakerService

核心功能：
1. 为每个下游服务 target (如 `http://localhost:3001`) 创建独立的熔断器实例
2. 提供 `execute()` 方法包装异步操作
3. 监听熔断器事件并记录日志
4. 管理熔断器实例的生命周期

### 步骤 5: 配置 axios-retry

在 `HttpModule` 配置中集成 axios-retry：

```typescript
import axiosRetry from 'axios-retry';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => {
        const axiosInstance = axios.create();
        axiosRetry(axiosInstance, {
          retries: 3,
          retryDelay: axiosRetry.exponentialDelay,
          retryCondition: (error) => {
            // 只对网络错误和5xx状态码重试
            return axiosRetry.isNetworkError(error) || 
                   axiosRetry.isRetryableError(error);
          },
        });
        return { axiosInstance };
      },
    }),
  ],
})
```

### 步骤 6: 修改 ProxyService

在 `proxy.service.ts` 中集成熔断器：

```typescript
async forward(req: Request, res: Response): Promise<void> {
  const route = this.matchRoute(req.path);
  if (!route) {
    throw new NotFoundException(`No proxy route found for path: ${req.path}`);
  }

  // 构造目标 URL
  const downstreamPath = req.path.replace(route.stripPrefix, '');
  const targetUrl = `${route.target}${downstreamPath}`;

  // 透传 query string
  const queryString = new URLSearchParams(
    req.query as Record<string, string>,
  ).toString();
  const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  // 透传 headers
  const headers = this.buildForwardHeaders(req);

  this.logger.log(`[PROXY] ${req.method} ${req.path} → ${fullUrl}`);

  try {
    // 通过熔断器执行请求
    const response = await this.circuitBreakerService.execute(
      route.target, // 使用 target 作为熔断器 key
      () => this.makeRequest(req.method, fullUrl, headers, req.body),
    );

    // 透传响应
    this.forwardResponse(res, response);
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      // 熔断器打开，返回降级响应
      const fallbackResponse = this.fallbackService.getFallbackResponse(
        route.target,
        req.path,
      );
      res.status(fallbackResponse.statusCode)
         .json(fallbackResponse.body);
    } else {
      // 其他错误
      this.handleProxyError(error, route.target, res);
    }
  }
}
```

### 步骤 7: 实现降级策略

在 `fallback.service.ts` 中定义不同场景的降级响应：

1. **静态响应**：返回预设的 JSON 数据
2. **缓存响应**：返回最近一次成功的响应（需实现缓存）
3. **功能降级**：对读操作返回空数据，写操作返回错误

### 步骤 8: 添加监控与日志

1. **熔断器事件监听**：记录状态变化（Closed → Open → Half-Open）
2. **重试统计**：记录重试次数和成功率
3. **性能指标**：熔断开启时长、平均响应时间等

### 步骤 9: 编写测试用例

1. **单元测试**：测试 CircuitBreakerService、FallbackService
2. **集成测试**：模拟下游服务故障，验证熔断和重试行为
3. **E2E 测试**：通过网关调用接口，验证全链路行为

### 步骤 10: 更新文档

1. **API 文档**：在 Swagger 中说明熔断和重试行为
2. **运维文档**：如何监控熔断状态、调整配置参数
3. **故障排查指南**：常见问题及解决方法

---

## 三、配置参数详解

### 3.1 熔断器配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| timeout | 5000 | 请求超时时间（毫秒） |
| errorThresholdPercentage | 50 | 错误率阈值（%） |
| resetTimeout | 30000 | 熔断持续时间（毫秒） |
| rollingCountTimeout | 10000 | 统计窗口时间（毫秒） |
| rollingCountBuckets | 10 | 统计窗口分桶数 |
| volumeThreshold | 5 | 最小请求量，低于此值不触发熔断 |

### 3.2 重试配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| retries | 3 | 最大重试次数 |
| retryDelay | exponentialDelay | 重试延迟策略 |
| shouldRetry | 见下方 | 重试条件判断函数 |

重试条件（默认）：
- 网络错误（ECONNRESET, ETIMEDOUT 等）
- 5xx 服务器错误
- 408 请求超时

### 3.3 环境变量配置

```bash
# 熔断器配置
CIRCUIT_BREAKER_TIMEOUT=5000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# 重试配置
HTTP_RETRY_COUNT=3
HTTP_RETRY_DELAY=exponential
```

---

## 四、代码结构变更

### 4.1 新增文件

```
apps/gateway/src/
├── resilience/
│   ├── resilience.module.ts
│   ├── circuit-breaker.service.ts
│   ├── fallback.service.ts
│   ├── constants/
│   │   └── resilience.constants.ts
│   ├── interfaces/
│   │   ├── circuit-breaker.interface.ts
│   │   └── fallback.interface.ts
│   └── decorators/
│       └── circuit-breaker.decorator.ts
└── proxy/
    ├── proxy.service.ts          # 修改
    └── proxy.controller.ts       # 不变
```

### 4.2 修改文件

1. **apps/gateway/src/proxy/proxy.service.ts**：集成熔断器和重试
2. **apps/gateway/src/app.module.ts**：导入 ResilienceModule
3. **package.json**：添加 opossum 和 axios-retry 依赖

### 4.3 模块依赖关系

```
AppModule
├── ProxyModule
│   ├── ProxyService → CircuitBreakerService
│   └── ProxyService → FallbackService
├── ResilienceModule
│   ├── CircuitBreakerService
│   └── FallbackService
└── HttpModule (配置 axios-retry)
```

---

## 五、测试方案

### 5.1 测试场景

| 场景 | 预期行为 | 验证点 |
|------|----------|--------|
| 下游服务正常 | 请求成功 | 响应时间、状态码 |
| 下游服务超时 | 触发重试 | 重试次数、最终结果 |
| 下游服务返回 5xx | 触发重试 | 重试次数、熔断统计 |
| 下游服务完全不可用 | 触发熔断 | 熔断器状态、降级响应 |
| 服务恢复后 | 自动恢复 | 半开状态探测、恢复正常 |

### 5.2 测试工具

1. **Jest + Supertest**：单元测试和集成测试
2. **Mock Server**：模拟下游服务故障
3. **Load Test**：压力测试验证熔断效果

### 5.3 测试用例示例

```typescript
describe('CircuitBreakerService', () => {
  it('should open circuit after consecutive failures', async () => {
    const service = new CircuitBreakerService();
    const target = 'http://localhost:9999'; // 不存在服务
    
    // 连续调用5次，应该触发熔断
    for (let i = 0; i < 5; i++) {
      await expect(
        service.execute(target, () => Promise.reject(new Error('模拟失败')))
      ).rejects.toThrow();
    }
    
    // 第6次调用应该返回 CircuitBreakerOpenError
    await expect(
      service.execute(target, () => Promise.resolve('成功'))
    ).rejects.toThrow(CircuitBreakerOpenError);
  });
});
```

---

## 六、部署与监控

### 6.1 监控指标

1. **熔断器状态**：每个下游服务的熔断器状态（0: Closed, 1: Open, 2: Half-Open）
2. **请求成功率**：成功数 / 总请求数
3. **平均响应时间**：包括重试的时间
4. **重试次数分布**：0次、1次、2次、3次重试的比例

### 6.2 告警规则

1. **熔断器打开**：立即告警
2. **错误率升高**：连续5分钟错误率 > 20%
3. **响应时间变长**：P95响应时间 > 5秒
4. **重试率升高**：重试比例 > 30%

### 6.3 配置管理

熔断器和重试参数应支持动态调整，可通过配置中心实时更新。

---

## 七、风险与应对

### 7.1 技术风险

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| 熔断器误判 | 中 | 服务不可用 | 合理配置参数，增加 volumeThreshold |
| 重试风暴 | 低 | 系统压力增大 | 限制最大重试次数，增加退避时间 |
| 内存泄漏 | 低 | 应用崩溃 | 定期清理无用的熔断器实例 |

### 7.2 业务风险

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| 降级体验差 | 中 | 用户满意度下降 | 设计合理的降级策略，提供友好提示 |
| 数据不一致 | 低 | 业务错误 | 非幂等操作不重试，写操作降级时明确提示 |

---

## 八、实施计划

### 阶段一：基础实现（1天）
1. 安装依赖，创建 ResilienceModule
2. 实现 CircuitBreakerService 和 FallbackService
3. 配置 axios-retry

### 阶段二：集成测试（1天）
1. 修改 ProxyService 集成熔断器
2. 编写单元测试和集成测试
3. 验证基本功能

### 阶段三：优化完善（1天）
1. 添加监控和日志
2. 优化配置参数
3. 编写文档

### 阶段四：生产验证（1天）
1. 在开发环境充分测试
2. 灰度发布到生产环境
3. 监控运行状态，调整参数

---

## 九、验收标准

1. ✅ 下游服务故障时，网关能正确触发熔断
2. ✅ 熔断开启时，返回预设的降级响应
3. ✅ 下游服务恢复后，熔断器能自动关闭
4. ✅ 网络抖动时，请求能自动重试最多3次
5. ✅ 熔断器状态变化有详细的日志记录
6. ✅ 配置参数支持环境变量覆盖
7. ✅ 有完整的测试用例覆盖

---

**下一步**：开始执行阶段一，创建基础模块和配置。