/**
 * 熔断器状态监控控制器
 * 提供熔断器状态查询接口
 */

import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CircuitBreakerService } from './circuit-breaker.service';
import { FallbackService } from './fallback.service';

@ApiTags('resilience')
@Controller('api/resilience')
export class ResilienceStatusController {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly fallbackService: FallbackService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: '获取所有熔断器状态' })
  @ApiResponse({ status: 200, description: '熔断器状态列表' })
  getCircuitBreakerStatus() {
    const status = this.circuitBreakerService.getAllStatus();
    const configs = this.fallbackService.getAllConfigs();
    
    return {
      timestamp: new Date().toISOString(),
      circuitBreakers: status,
      fallbackConfigs: configs,
      summary: {
        totalBreakers: Object.keys(status).length,
        openBreakers: Object.values(status).filter(s => s.state === 'open').length,
        halfOpenBreakers: Object.values(status).filter(s => s.state === 'half-open').length,
        closedBreakers: Object.values(status).filter(s => s.state === 'closed').length,
      },
    };
  }

  @Get('health')
  @ApiOperation({ summary: '熔断器健康检查' })
  @ApiResponse({ status: 200, description: '系统健康状态' })
  getHealth() {
    const status = this.circuitBreakerService.getAllStatus();
    const openBreakers = Object.values(status).filter(s => s.state === 'open');
    
    return {
      status: openBreakers.length === 0 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      openBreakers: openBreakers.map(s => ({
        target: Object.keys(status).find(key => status[key] === s),
        state: s.state,
        failureRate: s.failureRate,
        lastFailureAt: s.lastFailureAt,
      })),
      message: openBreakers.length === 0 
        ? 'All circuit breakers are closed' 
        : `${openBreakers.length} circuit breaker(s) are open`,
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: '获取熔断器指标' })
  @ApiResponse({ status: 200, description: '详细指标数据' })
  getMetrics() {
    const status = this.circuitBreakerService.getAllStatus();
    const metrics: any[] = [];

    for (const [target, stats] of Object.entries(status)) {
      metrics.push({
        target,
        state: stats.state,
        requestCount: stats.requestCount,
        failureCount: stats.failureCount,
        successCount: stats.successCount,
        failureRate: stats.failureRate,
        latencyMean: stats.latencyMean,
        lastFailureAt: stats.lastFailureAt,
        lastSuccessAt: stats.lastSuccessAt,
      });
    }

    return {
      timestamp: new Date().toISOString(),
      metrics,
    };
  }
}