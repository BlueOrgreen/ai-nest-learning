# 网关熔断与重试机制学习笔记

**日期：** 2026-04-30  
**项目：** my-firstnest  
**主题：** 熔断器 (Circuit Breaker) 与请求重试 (Retry) 在 API 网关中的应用

---

## 一、为什么需要熔断与重试？

在微服务架构中，网关作为入口，需要调用多个下游服务。下游服务可能因各种原因不可用或响应缓慢：

1. **瞬时故障**：网络抖动、服务重启、临时负载过高
2. **持续故障**：服务宕机、数据库连接失败、资源耗尽
3. **级联故障**：一个服务失败导致调用方积压，进而引发系统雪崩

**熔断与重试的目标**：
- 提高系统弹性 (Resilience)
- 防止故障扩散
- 提升用户体验（快速失败或优雅降级）

---

## 二、熔断器模式 (Circuit Breaker Pattern)

### 2.1 三种状态

1. **闭合 (Closed)**：正常状态，请求直接通过
2. **打开 (Open)**：故障状态，直接拒绝请求（快速失败）
3. **半开 (Half-Open)**：试探状态，允许少量请求通过，检测下游是否恢复

### 2.2 状态转换条件

| 状态 | 触发条件 | 行为 |
|------|----------|------|
| Closed → Open | 失败次数达到阈值（如 5 次） | 开启熔断，后续请求被拒绝 |
| Open → Half-Open | 熔断时间达到超时（如 30 秒） | 允许一个请求通过测试 |
| Half-Open → Closed | 测试请求成功 | 关闭熔断，恢复正常 |
| Half-Open → Open | 测试请求失败 | 继续保持熔断状态 |

### 2.3 关键参数

- **错误阈值**：多少次失败后触发熔断
- **熔断超时**：熔断持续多久后进入半开状态
- **滑动窗口**：统计失败的时间窗口（如最近 10 秒）
- **半开状态最大请求数**：允许通过的最大试探请求数

---

## 三、请求重试模式 (Retry Pattern)

### 3.1 重试策略

1. **简单重试**：固定间隔重试
2. **指数退避**：重试间隔指数增长（如 1s, 2s, 4s, 8s）
3. **抖动退避**：在退避基础上增加随机抖动，避免多个客户端同时重试

### 3.2 重试注意事项

- **幂等性**：只有 GET、HEAD、OPTIONS、PUT、DELETE 等幂等操作可安全重试
- **最大重试次数**：避免无限重试耗尽资源
- **超时设置**：每次重试的超时时间
- **重试条件**：仅对特定错误重试（如网络错误、5xx 状态码）

---

## 四、技术选型：opossum 与 axios-retry

### 4.1 opossum (Node.js 熔断器库)

**特点**：
- 遵循 Circuit Breaker 模式
- 支持事件驱动（`open`、`close`、`halfOpen`、`failure`、`success`）
- 可配置降级函数 (fallback)
- 支持 Promises 和 async/await

**基本用法**：
```javascript
const circuitBreaker = new CircuitBreaker(asyncFunction, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
});
```

### 4.2 axios-retry (Axios 重试插件)

**特点**：
- 无缝集成 axios
- 支持多种重试策略
- 可自定义重试条件
- 支持指数退避

**基本用法**：
```javascript
import axiosRetry from 'axios-retry';

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => 
    axiosRetry.isNetworkError(error) || 
    axiosRetry.isRetryableError(error),
});
```

---

## 五、在网关中的应用场景

### 5.1 熔断器应用

1. **按服务熔断**：为每个下游服务（user-service、order-service）创建独立的熔断器
2. **按接口熔断**：对关键接口（如支付、库存扣减）单独配置更严格的熔断策略
3. **健康检查**：结合健康检查端点，在熔断时快速探测服务恢复情况

### 5.2 重试应用

1. **瞬时故障恢复**：网络抖动、服务重启时自动重试
2. **负载均衡**：重试时切换到不同实例（需配合服务发现）
3. **分级重试**：对重要业务接口配置更多重试次数

### 5.3 降级策略

1. **静态响应**：返回预设的兜底数据
2. **缓存响应**：返回最近一次成功的响应
3. **功能降级**：关闭非核心功能，保证核心流程可用
4. **友好提示**：返回用户友好的错误信息

---

## 六、与现有网关架构的集成

### 6.1 集成点

- **ProxyService**：在转发请求前检查熔断器状态
- **HttpService**：配置 axios-retry 实现自动重试
- **ResilienceModule**：统一管理熔断器实例和配置

### 6.2 执行顺序

```
客户端请求
  → 路由匹配
  → 检查熔断器状态
      ↓ 熔断开启 → 执行降级策略 → 返回降级响应
      ↓ 熔断关闭 → 转发请求
          → axios-retry (最多重试 3 次)
          → 下游服务
          → 更新熔断器状态（成功/失败）
  → 返回响应
```

### 6.3 监控与日志

- **熔断器事件日志**：记录状态切换，便于故障排查
- **重试统计**：记录重试次数和成功率
- **性能指标**：熔断开启时长、重试延迟等

---

## 七、学习要点

1. **熔断不是银弹**：过度熔断可能导致系统整体不可用
2. **重试的副作用**：非幂等操作重试可能导致数据不一致
3. **配置调优**：根据业务特点调整熔断和重试参数
4. **监控告警**：熔断状态变化需要及时告警

---

## 八、参考资料

1. [Martin Fowler - Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
2. [opossum GitHub](https://github.com/nodeshift/opossum)
3. [axios-retry GitHub](https://github.com/softonic/axios-retry)
4. [微服务模式：重试、熔断、限流、降级](https://microservices.io/patterns/reliability/)

---

**下一步**：根据此学习笔记，制定详细的技术实现方案。