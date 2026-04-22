import { Module } from '@nestjs/common';
import { TerminusModule, TypeOrmHealthIndicator } from '@nestjs/terminus';

/**
 * DatabaseHealthModule
 *
 * 封装 @nestjs/terminus 的 TerminusModule，导出后供各服务的
 * HealthController 使用 TypeOrmHealthIndicator 进行数据库健康检查。
 *
 * 使用方式（在各服务 AppModule 中）：
 *   @Module({ imports: [DatabaseModule, DatabaseHealthModule] })
 *   export class AppModule {}
 *
 * 在 HealthController 中注入：
 *   constructor(
 *     private health: HealthCheckService,
 *     private db: TypeOrmHealthIndicator,
 *   ) {}
 */
@Module({
  imports: [TerminusModule],
  // 导出 TerminusModule（含 HealthCheckService）和 TypeOrmHealthIndicator
  // 使导入此模块的服务可直接注入这两个 provider
  providers: [TypeOrmHealthIndicator],
  exports: [TerminusModule, TypeOrmHealthIndicator],
})
export class DatabaseHealthModule {}
