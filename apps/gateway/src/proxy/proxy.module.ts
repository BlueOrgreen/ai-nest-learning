import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { PROXY_ROUTES, PROXY_ROUTES_TOKEN } from '../config/proxy-routes.config';
import { ResilienceModule } from '../resilience/resilience.module';

@Module({
  imports: [
    // 配置带重试机制的 HttpModule
    HttpModule.registerAsync({
      useFactory: () => {
        // 创建 axios 实例
        const axiosInstance = axios.create({
          timeout: 10000,
          maxRedirects: 3,
        });

        // 配置重试机制
        axiosRetry(axiosInstance, {
          retries: 3,
          retryDelay: axiosRetry.exponentialDelay,
          retryCondition: (error) => {
            // 重试条件：网络错误或可重试的服务器错误
            const isNetworkError = axiosRetry.isNetworkError(error);
            const isRetryableError = axiosRetry.isRetryableError(error);
            const isTimeoutError = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
            const is5xxError = error.response ? error.response.status >= 500 && error.response.status < 600 : false;
            const is408Error = error.response ? error.response.status === 408 : false;
            
            return isNetworkError || isRetryableError || isTimeoutError || is5xxError || is408Error;
          },
          // 在重试时记录日志
          onRetry: (retryCount, error, requestConfig) => {
            console.debug(`[HTTP Retry] ${requestConfig.method?.toUpperCase()} ${requestConfig.url} - Attempt ${retryCount} - Error: ${error.message}`);
          },
        });

        // 返回 HttpModule 配置
        return {
          axiosInstance,
          timeout: 10000,
          maxRedirects: 3,
        };
      },
    }),
    // 导入熔断与重试模块
    ResilienceModule,
  ],
  controllers: [ProxyController],
  providers: [
    ProxyService,
    {
      provide: PROXY_ROUTES_TOKEN,
      useValue: PROXY_ROUTES,
    },
  ],
})
export class ProxyModule {}
