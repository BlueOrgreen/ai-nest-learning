import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './orders/entities/order.entity';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '',
      database: 'nest_order_service',
      entities: [Order],
      synchronize: true, // 学习环境自动同步表结构，生产环境请用 migration
    }),
    OrdersModule,
  ],
})
export class AppModule {}
