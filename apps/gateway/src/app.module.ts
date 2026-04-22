import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { RequestIdMiddleware } from './middlewares/request-id.middleware';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [AuthModule, ProxyModule],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局 JWT 验证：所有路由默认需要登录，@Public() 可跳过
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 全局角色鉴权：@Roles('admin') 限制角色
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
