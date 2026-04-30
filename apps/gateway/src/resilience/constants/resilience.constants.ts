/**
 * 熔断与重试模块常量定义
 */

// 默认熔断器配置
export const DEFAULT_CIRCUIT_BREAKER_OPTIONS = {
  timeout: 5000, // 5秒超时
  errorThresholdPercentage: 50, // 错误率超过50%触发熔断
  resetTimeout: 30000, // 30秒后进入半开状态
  rollingCountTimeout: 10000, // 10秒滑动窗口
  rollingCountBuckets: 10, // 10个桶统计
  volumeThreshold: 5, // 最小请求量，低于此值不触发熔断
  name: 'default',
} as const;

// 重试配置
export const DEFAULT_RETRY_CONFIG = {
  retries: 3,
  retryDelay: 'exponential' as const,
  retryCondition: ['network', '5xx', '408'] as const, // 网络错误、5xx状态码、408超时
};

// 下游服务目标（从 proxy-routes.config.ts 自动提取）
export const DOWNSTREAM_TARGETS = {
  USER_SERVICE: 'http://localhost:3001',
  ORDER_SERVICE: 'http://localhost:3002',
} as const;

// 熔断器状态
export const CIRCUIT_BREAKER_STATES = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half-open',
} as const;

// 降级响应配置
export const FALLBACK_RESPONSES = {
  DEFAULT_STATUS_CODE: 503,
  DEFAULT_MESSAGE: 'Service temporarily unavailable. Please try again later.',
  CONTENT_TYPE: 'application/json',
} as const;

// 环境变量键名
export const ENV_KEYS = {
  CIRCUIT_BREAKER_TIMEOUT: 'CIRCUIT_BREAKER_TIMEOUT',
  CIRCUIT_BREAKER_ERROR_THRESHOLD: 'CIRCUIT_BREAKER_ERROR_THRESHOLD',
  CIRCUIT_BREAKER_RESET_TIMEOUT: 'CIRCUIT_BREAKER_RESET_TIMEOUT',
  HTTP_RETRY_COUNT: 'HTTP_RETRY_COUNT',
  HTTP_RETRY_DELAY: 'HTTP_RETRY_DELAY',
} as const;