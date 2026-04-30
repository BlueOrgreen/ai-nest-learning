/**
 * 降级服务
 * 提供熔断器打开时的降级响应
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  FallbackResponse,
  FallbackConfig,
  FallbackStrategy,
  FallbackStrategyMap,
} from './interfaces/fallback.interface';
import {
  FALLBACK_RESPONSES,
  DOWNSTREAM_TARGETS,
} from './constants/resilience.constants';

@Injectable()
export class FallbackService {
  private readonly logger = new Logger(FallbackService.name);
  
  // 降级策略配置映射
  private strategyMap: FallbackStrategyMap = {
    [DOWNSTREAM_TARGETS.USER_SERVICE]: {
      '/api/users': {
        strategy: 'static',
        data: {
          message: 'User service is temporarily unavailable',
          users: [],
        },
        contentType: 'application/json',
      },
      '/api/users/*': {
        strategy: 'static',
        data: {
          message: 'User service is temporarily unavailable',
          user: null,
        },
        contentType: 'application/json',
      },
      '/health': {
        strategy: 'static',
        data: {
          status: 'unhealthy',
          service: 'user-service',
          message: 'Service unavailable due to circuit breaker',
        },
        contentType: 'application/json',
      },
    },
    [DOWNSTREAM_TARGETS.ORDER_SERVICE]: {
      '/api/orders': {
        strategy: 'static',
        data: {
          message: 'Order service is temporarily unavailable',
          orders: [],
        },
        contentType: 'application/json',
      },
      '/api/orders/*': {
        strategy: 'static',
        data: {
          message: 'Order service is temporarily unavailable',
          order: null,
        },
        contentType: 'application/json',
      },
      '/api/products': {
        strategy: 'static',
        data: {
          message: 'Product service is temporarily unavailable',
          products: [],
        },
        contentType: 'application/json',
      },
      '/api/products/*': {
        strategy: 'static',
        data: {
          message: 'Product service is temporarily unavailable',
          product: null,
        },
        contentType: 'application/json',
      },
      '/health': {
        strategy: 'static',
        data: {
          status: 'unhealthy',
          service: 'order-service',
          message: 'Service unavailable due to circuit breaker',
        },
        contentType: 'application/json',
      },
    },
  };

  // 缓存最近的成功响应
  private responseCache = new Map<string, { response: any; timestamp: number }>();
  private readonly cacheMaxSize = 100;
  private readonly cacheTtl = 30000; // 30秒

  constructor() {
    this.logger.log('Fallback service initialized');
  }

  /**
   * 获取降级响应
   * @param target 下游服务 target
   * @param path 请求路径（已去掉网关前缀）
   * @param originalRequest 原始请求信息（可选）
   * @returns 降级响应
   */
  getFallbackResponse(
    target: string,
    path: string,
    originalRequest?: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    },
  ): FallbackResponse {
    // 查找匹配的降级配置
    const config = this.findFallbackConfig(target, path);
    
    // 根据策略生成响应
    let responseBody: any;
    let statusCode: number = FALLBACK_RESPONSES.DEFAULT_STATUS_CODE;
    
    switch (config.strategy) {
      case 'static':
        responseBody = config.data || {
          message: FALLBACK_RESPONSES.DEFAULT_MESSAGE,
          target,
          path,
          timestamp: new Date().toISOString(),
        };
        break;
        
      case 'cached':
        responseBody = this.getCachedResponse(target, path) || {
          message: 'Service unavailable. No cached response available.',
          target,
          path,
          timestamp: new Date().toISOString(),
        };
        statusCode = 200; // 缓存响应返回200
        break;
        
      case 'stub':
        responseBody = this.generateStubData(target, path, originalRequest) || {
          message: 'Service unavailable. Using stub data.',
          target,
          path,
          timestamp: new Date().toISOString(),
        };
        statusCode = 200; // 存根数据返回200
        break;
        
      case 'degraded':
        responseBody = this.generateDegradedResponse(target, path, originalRequest) || {
          message: 'Service unavailable. Functionality degraded.',
          target,
          path,
          timestamp: new Date().toISOString(),
        };
        statusCode = 200; // 功能降级返回200
        break;
        
      default:
        responseBody = {
          message: FALLBACK_RESPONSES.DEFAULT_MESSAGE,
          target,
          path,
          timestamp: new Date().toISOString(),
        };
    }

    this.logger.warn(`Returning fallback response for ${target}${path} (strategy: ${config.strategy})`);

    return {
      statusCode,
      headers: {
        'Content-Type': config.contentType || FALLBACK_RESPONSES.CONTENT_TYPE,
        'X-Fallback': 'true',
        'X-Fallback-Strategy': config.strategy,
        'X-Fallback-Target': target,
      },
      body: responseBody,
      isFallback: true,
      timestamp: new Date(),
    };
  }

  /**
   * 查找匹配的降级配置
   */
  private findFallbackConfig(target: string, path: string): FallbackConfig {
    // 获取该target的所有配置
    const targetConfigs = this.strategyMap[target];
    if (!targetConfigs) {
      return this.getDefaultConfig();
    }

    // 精确匹配
    if (targetConfigs[path]) {
      return targetConfigs[path];
    }

    // 通配符匹配
    for (const [pattern, config] of Object.entries(targetConfigs)) {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(path)) {
          return config;
        }
      }
    }

    // 前缀匹配
    for (const [pattern, config] of Object.entries(targetConfigs)) {
      if (path.startsWith(pattern.replace('/*', ''))) {
        return config;
      }
    }

    return this.getDefaultConfig();
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): FallbackConfig {
    return {
      strategy: 'static',
      contentType: FALLBACK_RESPONSES.CONTENT_TYPE,
    };
  }

  /**
   * 获取缓存的响应
   */
  private getCachedResponse(target: string, path: string): any | null {
    const cacheKey = `${target}:${path}`;
    const cached = this.responseCache.get(cacheKey);
    
    if (!cached) return null;
    
    // 检查缓存是否过期
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTtl) {
      this.responseCache.delete(cacheKey);
      return null;
    }
    
    return cached.response;
  }

  /**
   * 缓存成功响应
   */
  cacheResponse(target: string, path: string, response: any): void {
    const cacheKey = `${target}:${path}`;
    
    // 清理过期缓存
    this.cleanupCache();
    
    // 检查缓存大小
    if (this.responseCache.size >= this.cacheMaxSize) {
      // 删除最旧的缓存
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) {
        this.responseCache.delete(oldestKey);
      }
    }
    
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
    });
    
    this.logger.debug(`Cached response for ${cacheKey}`);
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.cacheTtl) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * 生成存根数据
   */
  private generateStubData(
    target: string,
    path: string,
    originalRequest?: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    },
  ): any {
    // 根据路径生成简单的存根数据
    if (path.includes('/users')) {
      return {
        id: 'stub-user-id',
        username: 'stub-user',
        email: 'stub@example.com',
        isStub: true,
      };
    }
    
    if (path.includes('/orders')) {
      return {
        id: 'stub-order-id',
        userId: 'stub-user-id',
        productId: 'stub-product-id',
        quantity: 1,
        totalPrice: 0,
        status: 'pending',
        isStub: true,
      };
    }
    
    if (path.includes('/products')) {
      return {
        id: 'stub-product-id',
        name: 'Stub Product',
        price: 0,
        description: 'This is a stub product for fallback',
        isStub: true,
      };
    }
    
    return null;
  }

  /**
   * 生成功能降级响应
   */
  private generateDegradedResponse(
    target: string,
    path: string,
    originalRequest?: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    },
  ): any {
    // 根据请求方法决定降级策略
    const method = originalRequest?.method?.toUpperCase() || 'GET';
    
    if (method === 'GET') {
      // 读操作返回空数据
      if (path.includes('/users')) return { users: [] };
      if (path.includes('/orders')) return { orders: [] };
      if (path.includes('/products')) return { products: [] };
      return { data: [] };
    } else {
      // 写操作返回错误
      return {
        error: 'Service unavailable',
        message: 'Write operations are disabled due to service degradation',
        suggestion: 'Please try again later',
      };
    }
  }

  /**
   * 添加或更新降级配置
   */
  setFallbackConfig(
    target: string,
    pathPattern: string,
    config: FallbackConfig,
  ): void {
    if (!this.strategyMap[target]) {
      this.strategyMap[target] = {};
    }
    
    this.strategyMap[target][pathPattern] = config;
    this.logger.log(`Updated fallback config for ${target}${pathPattern}`);
  }

  /**
   * 删除降级配置
   */
  removeFallbackConfig(target: string, pathPattern: string): boolean {
    if (!this.strategyMap[target]) return false;
    
    if (this.strategyMap[target][pathPattern]) {
      delete this.strategyMap[target][pathPattern];
      this.logger.log(`Removed fallback config for ${target}${pathPattern}`);
      return true;
    }
    
    return false;
  }

  /**
   * 获取所有降级配置
   */
  getAllConfigs(): FallbackStrategyMap {
    return JSON.parse(JSON.stringify(this.strategyMap)); // 深拷贝
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.responseCache.clear();
    this.logger.log('Cleared all fallback caches');
  }
}