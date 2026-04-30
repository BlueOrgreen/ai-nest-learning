# 消息队列学习计划

> 日期：2026-04-29
> 目标：理解消息队列核心概念，掌握 BullMQ 在 NestJS monorepo 中的实战接入，并了解 RabbitMQ / Kafka 的横向对比
> 学习周期：约 3-4 周

---

## 一、为什么需要消息队列

在动手之前，先建立"消息队列解决了什么问题"的直觉。

### 1.1 同步 vs 异步通信的取舍

**同步通信**（当前 monorepo 的方式）：

```
Client → Gateway → Order Service → (立即返回结果)
```

- 调用方等待被调用方完成才继续
- 优点：逻辑简单、结果即时可知
- 缺点：
  - 被调用方慢 → 调用方阻塞
  - 被调用方宕机 → 调用方报错
  - 多个下游依赖 → 耗时叠加

**异步通信**（引入消息队列后）：

```
Client → Gateway → Order Service → [发消息到队列] → 立即返回
                                         ↓
                                   Consumer 异步消费（发邮件、记日志、通知库存服务...）
```

- 调用方只负责"发消息"，不等消费结果
- 优点：响应快、下游故障不影响主流程、易于扩展
- 缺点：最终一致性而非强一致性，调试链路变长

**什么时候用同步，什么时候用异步？**

| 场景 | 推荐方式 | 理由 |
|------|---------|------|
| 用户登录、查询数据 | 同步 | 需要立即拿到结果 |
| 下单后发确认邮件 | 异步 | 邮件延迟 1-2 秒用户可接受 |
| 扣库存（强一致） | 同步 | 必须知道是否扣成功 |
| 下单后更新推荐系统 | 异步 | 推荐数据有延迟完全可以 |
| 日志写入、埋点上报 | 异步 | 不能让日志影响主业务耗时 |

---

### 1.2 消息队列解决的三个核心问题

#### 解耦

不引入消息队列时，Order Service 需要直接调用每一个下游：

```
Order Service ──→ EmailService.send()
             ──→ InventoryService.decrease()
             ──→ RecommendService.update()
             ──→ LogService.record()
```

任何一个下游接口变更，Order Service 都要跟着改。

引入消息队列后：

```
Order Service ──→ [order.created 事件]
                        ↓
              EmailConsumer（订阅）
              InventoryConsumer（订阅）
              RecommendConsumer（订阅）
              LogConsumer（订阅）
```

Order Service 只管发消息，不知道也不关心谁在消费。

#### 削峰

电商大促时，瞬间涌入 10000 QPS 的下单请求，数据库扛不住。

```
请求洪峰 (10000 QPS)
    ↓
[消息队列 Buffer]   ← 先全部接收，不丢失
    ↓
Consumer 按数据库处理能力匀速消费 (500 QPS)
```

队列充当了"水库"，把流量洪峰削平成稳定的处理速率。

#### 异步化

将耗时操作（发邮件、生成报表、图片压缩）从主流程剥离，主流程立即返回，提升接口响应速度。

---

## 二、核心概念

### 2.1 基础角色

| 角色 | 说明 | 本项目对应 |
|------|------|-----------|
| **Producer**（生产者） | 产生消息并推入队列的一方 | Order Service 下单后推消息 |
| **Consumer**（消费者） | 从队列取出消息并处理的一方 | EmailWorker、InventoryWorker |
| **Queue**（队列） | 消息的存储容器，FIFO | `order-created` 队列 |
| **Message**（消息） | 队列中的数据单元，通常是 JSON | `{ orderId, userId, items }` |
| **Broker**（代理） | 消息队列的服务端，负责存储和分发 | Redis（BullMQ）/ RabbitMQ 服务 |

### 2.2 Exchange 与 Topic（RabbitMQ / Kafka 概念）

BullMQ 是基于 Queue 的简单模型，RabbitMQ 和 Kafka 还引入了路由层：

**RabbitMQ — Exchange（交换机）**

Producer 不直接投递到 Queue，而是投递到 Exchange，由 Exchange 按路由规则分发：

```
Producer → Exchange（fanout / direct / topic）→ Queue A
                                              → Queue B
```

| Exchange 类型 | 路由规则 | 使用场景 |
|-------------|---------|---------|
| `direct` | routing key 精确匹配 | 点对点，指定队列消费 |
| `fanout` | 广播，所有绑定队列都收到 | 通知所有订阅方 |
| `topic` | routing key 通配符匹配（`order.*`） | 按事件类型路由 |

**Kafka — Topic（主题）**

```
Producer → Topic（order-events）→ Partition 0
                               → Partition 1（并行消费，提升吞吐）
Consumer Group A（消费 Partition 0）
Consumer Group B（消费全部，独立进度）
```

Kafka 的 Topic 支持多消费组独立消费同一份消息，适合日志流、审计场景。

---

### 2.3 消息确认（ACK）、重试、死信队列

#### 消息确认（ACK / NACK）

Consumer 处理完消息后，需要告诉 Broker"这条消息我处理好了，可以删除"：

```
Consumer 取出消息
    ↓
处理成功 → ACK（Acknowledge）→ Broker 删除该消息
处理失败 → NACK（Not Acknowledge）→ Broker 重新入队 / 进死信队列
```

**为什么需要 ACK？**
如果 Consumer 拿到消息后崩溃，Broker 若已删除消息则永久丢失；有了 ACK 机制，未确认的消息会重新分配给其他 Consumer。

#### 重试策略

| 重试方式 | 说明 |
|---------|------|
| 立即重试 | 失败后马上重试，适合瞬时网络抖动 |
| 延迟重试（指数退避） | 第 1 次等 1s，第 2 次等 2s，第 3 次等 4s... |
| 固定次数上限 | 超过最大重试次数后转入死信队列 |

BullMQ 内置延迟重试，配置示例：

```typescript
{
  attempts: 3,           // 最多重试 3 次
  backoff: {
    type: 'exponential', // 指数退避
    delay: 1000,         // 初始等待 1 秒
  },
}
```

#### 死信队列（Dead Letter Queue，DLQ）

消息重试次数耗尽后，不能直接丢弃（会导致数据丢失），转入专门的"死信队列"：

```
Queue (order-created)
    ↓ 失败 × 3
Dead Letter Queue (order-created:failed)
    ↓
人工排查 / 告警 / 修复后重放
```

**死信队列是生产环境必备**，是故障排查和数据兜底的最后一道防线。

---

### 2.4 消息投递语义

| 语义 | 说明 | 代价 |
|------|------|------|
| **At most once**（最多一次） | 消息可能丢失，不会重复 | 最低延迟，适合日志等可丢失场景 |
| **At least once**（至少一次） | 消息不会丢失，但可能重复投递 | 需要 Consumer 做幂等处理 |
| **Exactly once**（精确一次） | 消息不丢失也不重复 | 性能开销最大，Kafka 事务支持 |

**实际生产中最常用 At least once + Consumer 幂等**：

```typescript
// 幂等处理示例：用 orderId 作为去重键
async processOrderCreated(job: Job) {
  const { orderId } = job.data;
  const processed = await redis.get(`processed:${orderId}`);
  if (processed) return; // 已处理，跳过
  
  await sendEmail(job.data);
  await redis.set(`processed:${orderId}`, '1', 'EX', 86400);
}
```

---

## 三、BullMQ 实战（在现有 monorepo 中接入）

### 3.1 BullMQ 是什么

BullMQ 是基于 **Redis** 的 Node.js 队列库，`@nestjs/bull` / `@nestjs/bullmq` 提供官方 NestJS 集成。

**选择 BullMQ 的理由（对应本项目）：**
- Redis 已经在项目中用于限流（`ioredis`），无需新增基础设施
- API 简洁，NestJS 集成文档完善
- 内置 UI 面板（Bull Board），可视化监控队列状态
- 支持延迟任务、定时任务、优先级队列

**BullMQ vs Bull（旧版）：**
BullMQ 是 Bull 的重写版本，使用 Redis Streams，支持 Worker 并发、Job 依赖链，推荐新项目直接用 BullMQ。

---

### 3.2 实战场景设计

在现有 monorepo 中实现：**下单成功后，异步发送订单确认通知**

```
POST /api/orders
    ↓ Gateway 代理
Order Service 创建订单（写 DB）
    ↓ 同步返回 201
Order Service 推送消息到 BullMQ
    ↓ 异步
NotificationWorker 消费消息 → 打印/模拟发送邮件通知
```

**涉及文件变更：**

| 文件 | 变更 | 说明 |
|------|------|------|
| `apps/order-service/src/app.module.ts` | 修改 | 注册 BullModule |
| `apps/order-service/src/orders/orders.service.ts` | 修改 | 下单后 `queue.add()` |
| `apps/order-service/src/notification/notification.module.ts` | 新建 | NotificationModule |
| `apps/order-service/src/notification/notification.processor.ts` | 新建 | @Processor，消费消息 |

---

### 3.3 执行步骤

#### Step 1：安装依赖

```bash
pnpm add @nestjs/bullmq bullmq
```

#### Step 2：注册 BullModule

在 `apps/order-service/src/app.module.ts` 中：

```typescript
import { BullModule } from '@nestjs/bullmq';

BullModule.forRoot({
  connection: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379'),
  },
}),
BullModule.registerQueue({
  name: 'order-notification',
}),
```

#### Step 3：在 OrdersService 中推消息

```typescript
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

constructor(
  @InjectQueue('order-notification') private notificationQueue: Queue,
) {}

// 下单完成后
await this.notificationQueue.add('order-created', {
  orderId: order.id,
  userId: order.userId,
  totalAmount: order.totalAmount,
  createdAt: order.createdAt,
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
});
```

#### Step 4：编写 Processor（Consumer）

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('order-notification')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job): Promise<void> {
    const { orderId, userId, totalAmount } = job.data;
    this.logger.log(
      `[order-created] 订单 ${orderId} 创建成功，用户 ${userId}，金额 ${totalAmount}，模拟发送邮件通知...`
    );
    // TODO: 接入真实邮件服务（nodemailer / SendGrid）
  }
}
```

#### Step 5：接入 Bull Board（可视化 UI）

```bash
pnpm add @bull-board/nestjs @bull-board/express
```

```typescript
// main.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/queues');
createBullBoard({
  queues: [new BullMQAdapter(notificationQueue)],
  serverAdapter,
});
app.use('/queues', serverAdapter.getRouter());
// 访问：http://localhost:3002/queues
```

#### Step 6：验证

```bash
pnpm start:order

# 发一个创建订单请求
curl -X POST http://localhost:3002/orders \
  -H 'Content-Type: application/json' \
  -d '{"productId":"uuid-xxx","dirtyStock":0}'

# 观察控制台日志：应出现 [order-created] 订单 xxx 创建成功...
# 访问 http://localhost:3002/queues 查看队列状态
```

---

## 四、进阶：RabbitMQ / Kafka 对比 + NestJS Microservices

### 4.1 三者横向对比

| 维度 | BullMQ（Redis） | RabbitMQ | Kafka |
|------|----------------|---------|-------|
| **协议** | 基于 Redis 数据结构 | AMQP 0-9-1 | 自研二进制协议 |
| **消息模型** | Queue（简单队列） | Exchange → Queue（路由灵活） | Topic + Partition（分区日志） |
| **消息持久化** | Redis 持久化（RDB/AOF） | 写磁盘，高可靠 | 写磁盘，可保留任意时长 |
| **吞吐量** | 中（万级 QPS） | 中（万级 QPS） | 极高（百万级 QPS） |
| **消息顺序** | 队列内 FIFO | Queue 内有序 | Partition 内有序 |
| **消费模式** | Push（Worker 主动拉） | Push（Broker 推） | Pull（Consumer 拉） |
| **消息回溯** | 不支持（消费后删除） | 不支持（ACK 后删除） | 支持（按 offset 回放） |
| **学习曲线** | 低 | 中 | 高 |
| **适合场景** | 任务队列、定时任务、延迟任务 | 微服务通信、事件路由 | 日志收集、事件溯源、大数据管道 |
| **NestJS 集成** | `@nestjs/bullmq`（官方） | `@nestjs/microservices`（内置） | `@nestjs/microservices`（内置） |

**选型建议：**
- 任务队列（发邮件、异步处理、定时任务）→ **BullMQ**
- 微服务间事件通信（路由灵活）→ **RabbitMQ**
- 海量日志、事件溯源、需要回放 → **Kafka**

---

### 4.2 NestJS Microservices 模式

`@nestjs/microservices` 是 NestJS 官方的微服务通信框架，支持多种传输层：

| Transport  | 底层　　　　　　　| 特点　　　　　　　　　　　 |
| ------------| -------------------| ----------------------------|
| `TCP`      | TCP Socket　　　　| 最简单，局域网内服务间通信 |
| `Redis`    | Redis Pub/Sub　　 | 轻量，适合简单事件广播　　 |
| `MQTT`     | MQTT 协议　　　　 | IoT 设备通信　　　　　　　 |
| `RabbitMQ` | AMQP　　　　　　　| 企业级微服务通信　　　　　 |
| `Kafka`    | Kafka　　　　　　 | 高吞吐事件流　　　　　　　 |
| `gRPC`     | HTTP/2 + Protobuf | 高性能 RPC，强类型　　　　 |

**与 BullMQ 的区别：**

| 　　　　 | BullMQ　　　　　　　　　| NestJS Microservices　　　　　　　　　　|
| ----------| -------------------------| -----------------------------------------|
| 通信模式 | 单向（Fire and Forget） | 支持 Request-Response（等待回复）　　　 |
| 主要用途 | 后台任务队列　　　　　　| 服务间 RPC 通信　　　　　　　　　　　　 |
| 路由　　 | 按 Queue 名称　　　　　 | 按 `@MessagePattern` 或 `@EventPattern` |

**NestJS Microservices 示例（RabbitMQ）：**

```typescript
// Order Service 发送消息并等待回复（Request-Response 模式）
const result = await this.inventoryClient.send(
  { cmd: 'check-stock' },
  { productId: 'uuid-xxx', quantity: 1 },
).toPromise();

// Inventory Service 接收
@MessagePattern({ cmd: 'check-stock' })
checkStock(data: { productId: string; quantity: number }) {
  return { available: true, stock: 100 };
}
```

---

## 五、学习路线图

```
Week 1：阶段一 + 阶段二
  Day 1-2：同步 vs 异步，消息队列三大作用（理论 + 画图理解）
  Day 3-4：核心概念（Producer/Consumer/Queue/Exchange/Topic）
  Day 5-7：ACK/重试/死信队列/投递语义（重点，反复理解）

Week 2：阶段三（BullMQ 实战）
  Day 1：安装 + 注册 BullModule，跑通 Hello World
  Day 2-3：完成下单→通知完整链路
  Day 4：接入 Bull Board，观察队列状态
<!-- TODO 04.30 -->
  Day 5-7：模拟失败场景，验证重试和死信队列行为

Week 3：阶段四（进阶）
  Day 1-2：本地启动 RabbitMQ（Docker），理解 Exchange 路由
  Day 3-4：本地启动 Kafka，理解 Topic + Partition + Consumer Group
  Day 5-7：阅读 @nestjs/microservices 文档，尝试 TCP 或 RabbitMQ transport

Week 4：沉淀
  整理笔记，在 monorepo 中补充第二个队列场景（如：注册用户后发欢迎邮件）
  写一篇技术总结文档
```

---

## 六、参考资料

| 资料 | 地址 | 用途 |
|------|------|------|
| NestJS Queues 官方文档 | https://docs.nestjs.com/techniques/queues | BullMQ 接入 |
| BullMQ 官方文档 | https://docs.bullmq.io | 深入配置和 API |
| NestJS Microservices | https://docs.nestjs.com/microservices/basics | 微服务通信模式 |
| RabbitMQ 入门教程 | https://www.rabbitmq.com/tutorials | 官方 6 个示例，循序渐进 |
| Kafka 入门 | https://kafka.apache.org/quickstart | 官方 Quickstart |
| Bull Board | https://github.com/felixmosh/bull-board | 队列可视化 UI |

---

## 七、Git 提交计划

| 提交 | 内容 |
|------|------|
| `feat(order-service): 接入 BullMQ，下单后异步推送通知消息` | Week 2 实战 |
| `feat(order-service): 接入 Bull Board 队列监控面板` | Week 2 可视化 |
| `docs: 新增消息队列学习计划` | 本文件 |
