/**
 * 熔断器相关接口定义
 */

import CircuitBreaker from 'opossum';

// 熔断器配置接口
export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  volumeThreshold?: number;
  name?: string;
}

// 熔断器实例信息
export interface CircuitBreakerInstance {
  target: string;
  breaker: CircuitBreaker;
  stats: {
    failures: number;
    successes: number;
    state: string;
    lastFailureTime?: Date;
    lastSuccessTime?: Date;
  };
}

// 熔断器执行参数
export interface ExecuteOptions {
  timeout?: number;
  fallback?: (...args: any[]) => any;
}

// 熔断器事件类型
export type CircuitBreakerEvent = 
  | 'open'      // 熔断器打开
  | 'close'     // 熔断器关闭
  | 'halfOpen'  // 熔断器半开
  | 'failure'   // 请求失败
  | 'success'   // 请求成功
  | 'timeout'   // 请求超时
  | 'reject'    // 熔断器拒绝请求
  | 'fire'      // 请求开始执行
  | 'cacheHit'  // 缓存命中（如果启用缓存）;

// 熔断器统计信息
export interface CircuitBreakerStats {
  requestCount: number;
  failureCount: number;
  successCount: number;
  failureRate: number;
  latencyMean: number;
  latencyPercentiles: Record<string, number>;
  state: string;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  openedAt?: Date;
  closedAt?: Date;
}

// 熔断器错误
export class CircuitBreakerOpenError extends Error {
  constructor(target: string, message?: string) {
    super(message || `Circuit breaker for ${target} is open`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreakerTimeoutError extends Error {
  constructor(target: string, timeout: number) {
    super(`Request to ${target} timed out after ${timeout}ms`);
    this.name = 'CircuitBreakerTimeoutError';
  }
}