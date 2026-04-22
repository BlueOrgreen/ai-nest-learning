import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

/**
 * GET /health
 *
 * 探测数据库连通性，内部执行 SELECT 1。
 *
 * 响应示例（正常）：
 * {
 *   "status": "ok",
 *   "info": { "database": { "status": "up" } },
 *   "error": {},
 *   "details": { "database": { "status": "up" } }
 * }
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }
}
