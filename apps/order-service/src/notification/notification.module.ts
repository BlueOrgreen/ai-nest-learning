import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { NotificationProcessor } from './notification.processor';
import { NOTIFICATION_QUEUE } from './notification.constants';

/**
 * NotificationModule
 *
 * 职责：
 *   1. 注册 order-notification 队列（消费者角色）
 *   2. 提供 NotificationProcessor（Worker）
 *   3. 将队列挂载到 Bull Board UI（可在 /queues 页面查看）
 */
@Module({
  imports: [
    // 注册队列（同一队列名可在多个模块注册，底层共享同一个 Redis key）
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),

    // Bull Board：将此队列添加到可视化面板
    BullBoardModule.forFeature({
      name: NOTIFICATION_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [NotificationProcessor],
})
export class NotificationModule {}
