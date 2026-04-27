import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
 *
 * 响应示例（DB 宕机）：
 * {
 *   "status": "error",
 *   "info": {},
 *   "error": { "database": { "status": "down", "message": "..." } },
 *   "details": { "database": { "status": "down" } }
 * }
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @ApiOperation({
    summary: '数据库健康检查',
    description: '通过 @nestjs/terminus 执行 SELECT 1 探针，检测 DB 连通性。',
  })
  @ApiResponse({ status: 200, description: 'DB 正常，返回 { status: "ok" }' })
  @ApiResponse({ status: 503, description: 'DB 异常，返回 { status: "error" }' })
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }
}
