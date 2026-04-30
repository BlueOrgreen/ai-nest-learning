/**
 * 降级策略相关接口定义
 */

// 降级响应
export interface FallbackResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: any;
  isFallback: boolean;
  timestamp: Date;
}

// 降级策略类型
export type FallbackStrategy = 
  | 'static'      // 静态响应
  | 'cached'      // 缓存响应
  | 'stub'        // 存根数据
  | 'degraded';   // 功能降级

// 降级配置
export interface FallbackConfig {
  strategy: FallbackStrategy;
  data?: any; // 静态数据或存根数据
  cacheTtl?: number; // 缓存有效期（毫秒）
  contentType?: string;
}

// 降级策略映射
export interface FallbackStrategyMap {
  [target: string]: {
    [pathPattern: string]: FallbackConfig;
  };
}

// 降级服务选项
export interface FallbackServiceOptions {
  defaultStrategy?: FallbackStrategy;
  defaultStatusCode?: number;
  defaultMessage?: string;
  enableCache?: boolean;
  cacheMaxSize?: number;
  cacheTtl?: number;
}