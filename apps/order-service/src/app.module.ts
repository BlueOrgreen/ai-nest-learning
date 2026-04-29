import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { DatabaseModule, DatabaseHealthModule } from '@app/database';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { NotificationModule } from './notification/notification.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // ① 读取 .env（服务级优先，根目录兜底）
    ConfigModule.forRoot({
      envFilePath: [
        'apps/order-service/.env', // DB_DATABASE=nest_order_service
        '.env',                    // DB_HOST / DB_PORT / DB_USERNAME / 连接池等公共变量
      ],
      isGlobal: true,
    }),

    // ② 共享数据库连接（来自 libs/database）
    DatabaseModule,

    // ③ 健康检查模块（提供 TerminusModule + TypeOrmHealthIndicator）
    DatabaseHealthModule,

    // ④ BullMQ：全局 Redis 连接配置
    //    ConfigService 在 ConfigModule.forRoot({ isGlobal: true }) 后全局可用
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    // ⑤ Bull Board：队列可视化 UI
    //    挂载路径：http://localhost:3002/queues
    //    各队列通过 BullBoardModule.forFeature() 在对应 Module 中注册
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),

    // ⑥ 业务模块
    OrdersModule,
    ProductsModule,

    // ⑦ 通知模块（包含 order-notification 队列的 Processor）
    NotificationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
