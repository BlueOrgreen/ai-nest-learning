/**
 * 消息队列常量
 *
 * 统一管理队列名和 Job 名，避免魔法字符串散落在多处
 * 生产者（OrdersService）和消费者（NotificationProcessor）共同引用此文件
 */

/** 订单通知队列名称 */
export const NOTIFICATION_QUEUE = 'order-notification';

/** 订单创建事件的 Job 名称 */
export const ORDER_CREATED_JOB = 'order-created';
