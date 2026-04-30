/**
 * 熔断与重试模块
 * 提供熔断器、降级策略和重试机制
 */

import { Module, Global } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { FallbackService } from './fallback.service';
import { ResilienceStatusController } from './status.controller';

@Global() // 使模块中的 providers 在整个应用中可用
@Module({
  controllers: [ResilienceStatusController],
  providers: [CircuitBreakerService, FallbackService],
  exports: [CircuitBreakerService, FallbackService],
})
export class ResilienceModule {}