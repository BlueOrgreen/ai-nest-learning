/**
 * 熔断器服务
 * 为每个下游服务 target 创建独立的熔断器实例
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import {
  CircuitBreakerOptions,
  CircuitBreakerInstance,
  CircuitBreakerOpenError,
  CircuitBreakerTimeoutError,
  CircuitBreakerStats,
  CircuitBreakerEvent,
} from './interfaces/circuit-breaker.interface';
import { DEFAULT_CIRCUIT_BREAKER_OPTIONS } from './constants/resilience.constants';

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);
  
  // 存储所有熔断器实例，key 为下游服务 target
  private readonly breakers = new Map<string, CircuitBreakerInstance>();
  
  // 默认配置
  private defaultOptions: CircuitBreakerOptions = DEFAULT_CIRCUIT_BREAKER_OPTIONS;

  /**
   * 执行通过熔断器保护的异步操作
   * @param target 下游服务 target，如 http://localhost:3001
   * @param operation 要执行的异步操作
   * @param options 执行选项
   * @returns 操作结果
   */
  async execute<T>(
    target: string,
    operation: () => Promise<T>,
    options: CircuitBreakerOptions = {},
  ): Promise<T> {
    const breaker = this.getOrCreateBreaker(target, options);
    
    try {
      const result = await breaker.breaker.fire(operation);
      return result as T;
    } catch (error) {
      // opossum 会将熔断器打开时的错误包装成 'CircuitBreakerOpenError'
      // 但我们自己定义的错误类更明确
      if (error.name === 'CircuitBreakerOpenError' || breaker.breaker.opened) {
        throw new CircuitBreakerOpenError(target);
      }
      
      if (error.name === 'TimeoutError') {
        throw new CircuitBreakerTimeoutError(target, (breaker.breaker as any).timeout);
      }
      
      // 其他错误直接抛出
      throw error;
    }
  }

  /**
   * 获取或创建熔断器实例
   */
  private getOrCreateBreaker(
    target: string,
    options: CircuitBreakerOptions = {},
  ): CircuitBreakerInstance {
    // 检查是否已存在
    const existing = this.breakers.get(target);
    if (existing) {
      return existing;
    }

    // 合并配置
    const mergedOptions: CircuitBreakerOptions = {
      ...this.defaultOptions,
      ...options,
      name: target,
    };

    // 创建熔断器实例
    const breaker = new CircuitBreaker(async (fn: () => Promise<any>) => {
      return await fn();
    }, mergedOptions);

    // 创建实例信息
    const instance: CircuitBreakerInstance = {
      target,
      breaker,
      stats: {
        failures: 0,
        successes: 0,
        state: breaker.closed ? 'closed' : breaker.opened ? 'open' : 'half-open',
      },
    };

    // 设置事件监听器
    this.setupEventListeners(breaker, target);

    // 存储实例
    this.breakers.set(target, instance);

    this.logger.log(`Created circuit breaker for ${target} with options:`, {
      timeout: mergedOptions.timeout,
      errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
      resetTimeout: mergedOptions.resetTimeout,
    });

    return instance;
  }

  /**
   * 设置熔断器事件监听器
   */
  private setupEventListeners(breaker: CircuitBreaker, target: string): void {
    breaker.on('open', () => {
      this.logger.warn(`Circuit breaker for ${target} is OPEN`);
      this.updateStats(target);
    });

    breaker.on('close', () => {
      this.logger.log(`Circuit breaker for ${target} is CLOSED`);
      this.updateStats(target);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker for ${target} is HALF-OPEN`);
      this.updateStats(target);
    });

    breaker.on('failure', (error) => {
      this.logger.debug(`Request to ${target} failed: ${error.message}`);
      this.updateStats(target);
    });

    breaker.on('success', () => {
      this.logger.debug(`Request to ${target} succeeded`);
      this.updateStats(target);
    });

    breaker.on('timeout', () => {
      this.logger.warn(`Request to ${target} timed out`);
    });

    breaker.on('reject', () => {
      this.logger.warn(`Request to ${target} rejected by circuit breaker`);
    });
  }

  /**
   * 更新熔断器统计信息
   */
  private updateStats(target: string): void {
    const instance = this.breakers.get(target);
    if (!instance) return;

    const stats = instance.breaker.stats;
    instance.stats = {
      failures: stats.failures,
      successes: stats.successes,
      state: instance.breaker.closed ? 'closed' : instance.breaker.opened ? 'open' : 'half-open',
      lastFailureTime: stats.latencyTimes && stats.latencyTimes.length > 0 
        ? new Date(Math.max(...stats.latencyTimes)) 
        : undefined,
      lastSuccessTime: stats.latencyTimes && stats.latencyTimes.length > 0
        ? new Date(Math.min(...stats.latencyTimes))
        : undefined,
    };
  }

  /**
   * 获取熔断器状态
   */
  getStatus(target: string): CircuitBreakerStats | null {
    const instance = this.breakers.get(target);
    if (!instance) return null;

    const stats = instance.breaker.stats;
    return {
      requestCount: stats.fires,
      failureCount: stats.failures,
      successCount: stats.successes,
      failureRate: stats.fires > 0 ? stats.failures / stats.fires : 0,
      latencyMean: stats.latencyMean || 0,
      latencyPercentiles: (stats as any).latencyPercentiles || {},
      state: instance.stats.state,
      lastFailureAt: instance.stats.lastFailureTime,
      lastSuccessAt: instance.stats.lastSuccessTime,
      openedAt: instance.breaker.opened ? new Date() : undefined,
      closedAt: instance.breaker.closed ? new Date() : undefined,
    };
  }

  /**
   * 获取所有熔断器状态
   */
  getAllStatus(): Record<string, CircuitBreakerStats> {
    const result: Record<string, CircuitBreakerStats> = {};
    
    for (const [target, instance] of this.breakers.entries()) {
      const status = this.getStatus(target);
      if (status) {
        result[target] = status;
      }
    }
    
    return result;
  }

  /**
   * 手动重置熔断器
   */
  reset(target: string): boolean {
    const instance = this.breakers.get(target);
    if (!instance) return false;

    instance.breaker.close();
    this.logger.log(`Manually reset circuit breaker for ${target}`);
    return true;
  }

  /**
   * 手动打开熔断器（用于测试）
   */
  open(target: string): boolean {
    const instance = this.breakers.get(target);
    if (!instance) return false;

    instance.breaker.open();
    this.logger.log(`Manually opened circuit breaker for ${target}`);
    return true;
  }

  /**
   * 更新熔断器配置
   */
  updateConfig(target: string, options: CircuitBreakerOptions): boolean {
    const instance = this.breakers.get(target);
    if (!instance) return false;

    // opossum 不支持动态更新配置，需要重新创建熔断器
    this.logger.warn(`Cannot dynamically update circuit breaker config for ${target}. Recreating...`);
    
    // 保存当前状态
    const currentStats = this.getStatus(target);
    
    // 删除旧的熔断器
    this.breakers.delete(target);
    
    // 创建新的熔断器
    this.getOrCreateBreaker(target, options);
    
    this.logger.log(`Recreated circuit breaker for ${target} with new config`);
    return true;
  }

  /**
   * 清理长时间未使用的熔断器
   */
  cleanupUnusedBreakers(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [target, instance] of this.breakers.entries()) {
      const lastUsed = instance.stats.lastFailureTime || instance.stats.lastSuccessTime;
      
      if (!lastUsed) continue;
      
      const age = now - lastUsed.getTime();
      
      if (age > maxAgeMs) {
        // 关闭熔断器
        instance.breaker.close();
        this.breakers.delete(target);
        this.logger.log(`Cleaned up unused circuit breaker for ${target} (age: ${age}ms)`);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * 模块销毁时关闭所有熔断器
   */
  onModuleDestroy() {
    this.logger.log('Closing all circuit breakers...');
    
    for (const [target, instance] of this.breakers.entries()) {
      instance.breaker.close();
      this.logger.debug(`Closed circuit breaker for ${target}`);
    }
    
    this.breakers.clear();
  }
}