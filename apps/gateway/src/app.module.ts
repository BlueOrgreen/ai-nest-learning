import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
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
export class AppModule {}
