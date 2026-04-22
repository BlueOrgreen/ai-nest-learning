import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { RequestIdMiddleware } from './middlewares/request-id.middleware';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    // 全局限流配置（ttl 单位：毫秒，v5+）
    // 默认策略：每个 IP 每 60 秒最多 100 次请求
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    ProxyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ⚡ Guard 执行顺序（按数组顺序依次执行）：
    // ① ThrottlerGuard 必须第一：对所有请求（含未登录）计数，防止攻击者用 401 响应绕过限流
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // ② JWT 验证：校验 token 合法性
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // ③ 角色鉴权：校验是否有接口所需角色
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  /**
   * 中间件注册顺序（按 apply 参数从左到右依次执行）：
   *
   *  ① RequestIdMiddleware — 注入 x-request-id，必须最先执行，
   *                           后续所有中间件和 ProxyService 才能读到这个 ID
   *  ② LoggerMiddleware    — 记录请求日志（依赖 x-request-id 已注入）
   *
   * 注意：CORS 通过 main.ts 的 app.enableCors() 处理，
   *        它在中间件管道之前执行，专门应对浏览器 OPTIONS 预检请求。
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, LoggerMiddleware)
      .forRoutes('*');
  }
}
