import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, DatabaseHealthModule } from '@app/database';
import { UsersModule } from './users/users.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // ① 读取 .env（服务级优先，根目录兜底）
    ConfigModule.forRoot({
      envFilePath: [
        'apps/user-service/.env', // DB_DATABASE=nest_user_service
        '.env',                   // DB_HOST / DB_PORT / DB_USERNAME / 连接池等公共变量
      ],
      isGlobal: true,
    }),

    // ② 共享数据库连接（来自 libs/database）
    DatabaseModule,

    // ③ 健康检查模块（提供 TerminusModule + TypeOrmHealthIndicator）
    DatabaseHealthModule,

    // ④ 业务模块
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
