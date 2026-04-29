import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { NOTIFICATION_QUEUE } from '../notification/notification.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    // 注册 order-notification 队列，让 OrdersService 可以注入 Queue 对象（生产者角色）
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
