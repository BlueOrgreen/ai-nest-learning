import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE, ORDER_CREATED_JOB } from './notification.constants';

/**
 * 订单通知消费者（Consumer）
 *
 * @Processor(NOTIFICATION_QUEUE) 标记此类为指定队列的 Worker
 * 继承 WorkerHost 并实现 process() 方法，BullMQ 会自动将队列中的 Job 分发给 process()
 *
 * 消费流程：
 *   BullMQ Worker 从 Redis 取出 Job
 *     → 调用 process()
 *     → 成功：自动 ACK（Job 状态变为 completed）
 *     → 抛出异常：自动 NACK + 按 backoff 策略延迟重试
 *     → 重试次数耗尽：Job 状态变为 failed（可在 Bull Board 查看）
 */
@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  /**
   * 统一入口：BullMQ 将所有 Job 路由到此方法
   * 通过 job.name 区分不同类型的事件
   */
  async process(job: Job): Promise<void> {
    switch (job.name) {
      case ORDER_CREATED_JOB:
        await this.handleOrderCreated(job);
        break;
      default:
        this.logger.warn(`[${NOTIFICATION_QUEUE}] 未知 Job 类型：${job.name}`);
    }
  }

  /**
   * 处理"订单创建"事件
   *
   * 真实场景：此处调用邮件服务（nodemailer / SendGrid）发送确认邮件
   * 当前实现：打印日志模拟发送，方便学习阶段观察
   *
   * 幂等性说明：
   *   BullMQ 默认 At-least-once，重试时 process() 可能被多次调用。
   *   生产环境建议用 orderId 做幂等检查（Redis SET NX），避免重复发邮件。
   */
  private async handleOrderCreated(job: Job): Promise<void> {
    const { orderId, userId, productId, quantity, amount, createdAt } = job.data;

    this.logger.log(
      `[order-created] 开始处理 Job #${job.id}（第 ${job.attemptsMade + 1} 次尝试）`,
    );

    // ── 模拟发送通知（替换为真实邮件/短信逻辑）────────────────
    this.logger.log(
      `📧 [模拟通知] 订单确认邮件已发送\n` +
      `   订单ID   : ${orderId}\n` +
      `   用户ID   : ${userId}\n` +
      `   商品ID   : ${productId}\n` +
      `   数量     : ${quantity}\n` +
      `   金额     : ¥${amount}\n` +
      `   创建时间 : ${createdAt}`,
    );
    // ─────────────────────────────────────────────────────────

    // 模拟偶发失败：可临时取消注释验证重试机制
    // if (Math.random() < 0.5) throw new Error('模拟邮件服务超时，触发重试');
  }

  // ── Worker 生命周期事件钩子 ──────────────────────────────

  /** Job 完成（ACK）后触发 */
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`[order-notification] Job #${job.id} 已完成`);
  }

  /** Job 失败（重试耗尽）后触发 */
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `[order-notification] Job #${job.id} 最终失败（已重试 ${job.attemptsMade} 次）：${error.message}`,
    );
  }
}
