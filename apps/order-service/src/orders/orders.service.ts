import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order } from './entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { NOTIFICATION_QUEUE, ORDER_CREATED_JOB } from '../notification/notification.constants';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    /**
     * DataSource：TypeORM 的数据源对象，持有连接池
     * 用途：
     *   1. dataSource.transaction()  — 写法一（推荐）
     *   2. dataSource.createQueryRunner() — 写法二（QueryRunner 手动控制）
     */
    private readonly dataSource: DataSource,
    /**
     * BullMQ Queue 注入（生产者）
     * 队列名称由常量 NOTIFICATION_QUEUE 统一管理，避免魔法字符串
     */
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  async findAll(): Promise<Array<Order & { productName?: string }>> {
    const results = await this.ordersRepo
      .createQueryBuilder('order')
      .leftJoin(Product, 'product', 'product.id = order.productId')
      .addSelect('product.name', 'productName')
      .orderBy('order.createdAt', 'DESC')
      .getRawAndEntities();

      console.log("results.entities===>", results.entities);
      console.log("results.raw===>", results.raw);
      
    // results.entities 是 Order 实体数组
    // results.raw 是原始数据数组，包含额外的 select 字段
    return results.entities.map((order, index) => ({
      ...order,
      productName: results.raw[index]?.productName || null,
    }));
  }

  async findOne(id: string): Promise<Order & { productName?: string }> {
    const result = await this.ordersRepo
      .createQueryBuilder('order')
      .leftJoin(Product, 'product', 'product.id = order.productId')
      .addSelect('product.name', 'productName')
      .where('order.id = :id', { id })
      .getRawAndEntities();

    if (result.entities.length === 0) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    const order = result.entities[0];
    const productName = result.raw[0]?.productName || null;
    return {
      ...order,
      productName,
    };
  }

  async findByUser(userId: string): Promise<Array<Order & { productName?: string }>> {
    const results = await this.ordersRepo
      .createQueryBuilder('order')
      .leftJoin(Product, 'product', 'product.id = order.productId')
      .addSelect('product.name', 'productName')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .getRawAndEntities();

    return results.entities.map((order, index) => ({
      ...order,
      productName: results.raw[index]?.productName || null,
    }));
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    const order = await this.dataSource.transaction(async (manager) => {
      // 1. 查询商品（用 manager，而不是 this.productsService）
      const product = await manager.findOne(Product, {
        where: { id: dto.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product #${dto.productId} not found`);
      }

      // 2. 检查库存
      if (product.stock < dto.quantity) {
        throw new BadRequestException(
          `库存不足：商品 "${product.name}" 当前库存 ${product.stock}，需要 ${dto.quantity}`,
        );
      }

      // 3. 扣减库存
      await manager.save(Product, {
        ...product,
        stock: product.stock - dto.quantity,
      });

      // 4. 创建订单
      const newOrder = manager.create(Order, {
        userId: dto.userId,
        productId: dto.productId,
        quantity: dto.quantity,
        description: dto.description,
        amount: Number(product.price) * dto.quantity,
      });
      return manager.save(Order, newOrder);
      // ↑ 回调正常返回 → TypeORM 自动 COMMIT
      // ↑ 任何步骤抛异常 → TypeORM 自动 ROLLBACK
    });

    // ── 事务提交成功后，异步推送通知消息 ──────────────────
    // 注意：推消息放在事务外，避免消息推出去但事务回滚的不一致
    await this.notificationQueue.add(
      ORDER_CREATED_JOB,
      {
        orderId: order.id,
        userId: order.userId,
        productId: order.productId,
        quantity: order.quantity,
        amount: order.amount,
        createdAt: order.createdAt,
      },
      {
        attempts: 3,          // 失败最多重试 3 次
        backoff: {
          type: 'exponential',
          delay: 1000,        // 初始等待 1 秒，指数退避
        },
        removeOnComplete: 100, // 保留最近 100 条已完成记录（Bull Board 可查）
        removeOnFail: 50,      // 保留最近 50 条失败记录
      },
    );
    this.logger.log(`[Queue] 订单 ${order.id} 已推送通知消息`);

    return order;
  }

  /**
   * 创建订单 — 写法二：QueryRunner 手动控制（对比学习用）
   *
   * 与写法一功能相同，但手动管理 BEGIN / COMMIT / ROLLBACK
   * 适合需要在事务中执行非数据库操作（如发消息队列）的场景
   */
  async createWithQueryRunner(dto: CreateOrderDto): Promise<Order> {
    // 1. 从连接池取出一个专用连接
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // 2. 开启事务（相当于 BEGIN）
    await queryRunner.startTransaction();

    try {
      // 3. 业务操作
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: dto.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product #${dto.productId} not found`);
      }

      if (product.stock < dto.quantity) {
        throw new BadRequestException(
          `库存不足：商品 "${product.name}" 当前库存 ${product.stock}，需要 ${dto.quantity}`,
        );
      }

      await queryRunner.manager.save(Product, {
        ...product,
        stock: product.stock - dto.quantity,
      });

      const order = queryRunner.manager.create(Order, {
        userId: dto.userId,
        productId: dto.productId,
        quantity: dto.quantity,
        description: dto.description,
        amount: Number(product.price) * dto.quantity,
      });
      const saved = await queryRunner.manager.save(Order, order);

      // 4. 提交（相当于 COMMIT）
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      // 5. 出错时回滚（相当于 ROLLBACK）
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      // 6. 无论成功失败，释放连接回连接池（必须执行！否则连接池耗尽）
      await queryRunner.release();
    }
  }

  // ─────────────────────────────────────────────
  //  阶段二：并发异常演示（仅用于学习，勿用于生产）
  // ─────────────────────────────────────────────

  /**
   * 工具函数：等待指定毫秒数
   * 用于在事务中途"暂停"，制造并发时间窗口
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 【演示：脏读】
   *
   * 隔离级别：READ UNCOMMITTED（最低，不阻止读未提交数据）
   *
   * 配合 simulateDirtyWrite() 使用：
   *   1. 先调用 simulateDirtyWrite（它会修改数据但暂停 5 秒不提交）
   *   2. 在 5 秒内调用 demoDirtyRead
   *   3. demoDirtyRead 会读到"尚未提交的修改"（脏数据）
   *   4. simulateDirtyWrite 最终 ROLLBACK，脏数据消失
   *
   * 观察：firstRead 的值是 simulateDirtyWrite 写入但未提交的值
   */
  async demoDirtyRead(productId: string): Promise<{
    phenomenon: string;
    isolationLevel: string;
    firstRead: number;
    note: string;
  }> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    // READ UNCOMMITTED：允许读取其他事务未提交的数据
    await qr.startTransaction('READ UNCOMMITTED');

    try {
      const product = await qr.manager.findOne(Product, {
        where: { id: productId },
      });
      if (!product) throw new NotFoundException(`Product #${productId} not found`);

      await qr.commitTransaction();
      return {
        phenomenon: '脏读 (Dirty Read)',
        isolationLevel: 'READ UNCOMMITTED',
        firstRead: product.stock,
        note: '如果此时另一个事务修改了 stock 但未提交，这里会读到未提交的值',
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * 【演示：制造脏写场景】
   *
   * 修改数据后暂停 5 秒，最终 ROLLBACK（模拟事务回滚）
   * 在暂停期间，demoDirtyRead 若在 READ UNCOMMITTED 下读取，会读到这里写的值
   */
  async simulateDirtyWrite(
    productId: string,
    dirtyStock: number,
  ): Promise<{ message: string }> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const product = await qr.manager.findOne(Product, {
        where: { id: productId },
      });
      if (!product) throw new NotFoundException(`Product #${productId} not found`);

      const originalStock = product.stock;

      // 写入脏数据（不提交）
      await qr.manager.update(Product, productId, { stock: dirtyStock });
      this.logger.warn(
        `[DirtyWrite] stock 已被修改为 ${dirtyStock}（未提交），5秒后回滚`,
      );

      // 暂停 5 秒，给 demoDirtyRead 制造时间窗口
      await this.sleep(5000);

      // 回滚，模拟事务失败
      await qr.rollbackTransaction();
      this.logger.warn(
        `[DirtyWrite] ROLLBACK 完成，stock 恢复为 ${originalStock}`,
      );

      return {
        message: `已回滚。stock 从 ${dirtyStock} 恢复为 ${originalStock}。如果期间有人用 READ UNCOMMITTED 读取，他们看到的是 ${dirtyStock}（脏数据）`,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * 【演示：不可重复读】
   *
   * 隔离级别：READ COMMITTED
   *
   * 在同一事务内读两次同一行：
   *   第一次读 → sleep 3 秒（等待外部修改并提交）→ 第二次读
   *
   * 如果两次之间有人修改了 stock 并 COMMIT，
   * READ COMMITTED 下第二次读会看到新值（不可重复读）
   *
   * 操作步骤：
   *   1. 调用此接口（它会等待 3 秒）
   *   2. 3 秒内用 PATCH /orders/:id 或直接 SQL 修改 stock
   *   3. 观察返回的 firstRead 和 secondRead 是否不同
   */
  async demoNonRepeatableRead(productId: string): Promise<{
    phenomenon: string;
    isolationLevel: string;
    firstRead: number;
    secondRead: number;
    isDifferent: boolean;
    note: string;
  }> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    // READ COMMITTED：每次读取都看到最新已提交数据
    await qr.startTransaction('READ COMMITTED');

    try {
      // 第一次读
      const p1 = await qr.manager.findOne(Product, { where: { id: productId } });
      if (!p1) throw new NotFoundException(`Product #${productId} not found`);
      const firstRead = p1.stock;

      this.logger.log(
        `[NonRepeatableRead] 第一次读 stock=${firstRead}，等待 3 秒（请在此期间修改 stock）`,
      );

      // 等待期间，外部可以修改数据
      await this.sleep(3000);

      // 第二次读（READ COMMITTED 下会看到外部已提交的修改）
      const p2 = await qr.manager.findOne(Product, { where: { id: productId } });
      const secondRead = p2?.stock ?? firstRead;

      await qr.commitTransaction();

      const different = firstRead !== secondRead;
      return {
        phenomenon: '不可重复读 (Non-repeatable Read)',
        isolationLevel: 'READ COMMITTED',
        firstRead,
        secondRead,
        isDifferent: different,
        note: different
          ? '✅ 复现成功：同一事务内，两次读取结果不同'
          : '⚠️ 未复现：等待期间没有其他事务修改数据',
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * 【演示：幻读】
   *
   * 隔离级别：READ COMMITTED（没有间隙锁，无法阻止插入）
   *
   * 在同一事务内统计同一条件的行数两次：
   *   第一次统计 → sleep 3 秒（等待外部插入新数据）→ 第二次统计
   *
   * 操作步骤：
   *   1. 调用此接口（它会等待 3 秒）
   *   2. 3 秒内调用 POST /orders 新增一条该用户的订单
   *   3. 观察 firstCount 和 secondCount 是否不同
   */
  async demoPhantomRead(userId: string): Promise<{
    phenomenon: string;
    isolationLevel: string;
    firstCount: number;
    secondCount: number;
    isDifferent: boolean;
    note: string;
  }> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    // READ COMMITTED：无间隙锁，其他事务可以在范围内插入新数据
    await qr.startTransaction('READ COMMITTED');

    try {
      // 第一次统计
      const firstCount = await qr.manager.count(Order, {
        where: { userId },
      });

      this.logger.log(
        `[PhantomRead] 第一次统计 userId=${userId} 订单数=${firstCount}，等待 3 秒`,
      );

      // 等待期间，外部可以插入新订单
      await this.sleep(3000);

      // 第二次统计（READ COMMITTED 下可能多出新插入的行）
      const secondCount = await qr.manager.count(Order, {
        where: { userId },
      });

      await qr.commitTransaction();

      return {
        phenomenon: '幻读 (Phantom Read)',
        isolationLevel: 'READ COMMITTED',
        firstCount,
        secondCount,
        isDifferent: firstCount !== secondCount,
        note: firstCount !== secondCount
          ? '✅ 复现成功：同一事务内，两次范围查询结果不同（出现了新行）'
          : '⚠️ 未复现：等待期间没有其他事务插入新数据',
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────
  //  阶段三：隔离级别演示
  // ─────────────────────────────────────────────

  /**
   * 查询当前 MySQL 会话的默认事务隔离级别
   *
   * MySQL 系统变量：@@transaction_isolation
   * 默认值：REPEATABLE-READ
   */
  async getSessionIsolationLevel(): Promise<{
    level: string;
    description: string;
  }> {
    const result = await this.dataSource.query(
      'SELECT @@transaction_isolation AS level',
    );
    const level: string = result[0]?.level ?? 'UNKNOWN';

    const descriptions: Record<string, string> = {
      'READ-UNCOMMITTED': '读未提交：可读取未提交数据，会产生脏读/不可重复读/幻读',
      'READ-COMMITTED': '读已提交：只读已提交数据，解决脏读，但仍有不可重复读/幻读',
      'REPEATABLE-READ': 'MySQL 默认：快照读保证同一事务内结果一致，间隙锁部分解决幻读',
      SERIALIZABLE: '串行化：最高隔离，完全串行执行，无任何并发异常，但性能最低',
    };

    return {
      level,
      description: descriptions[level] ?? '未知隔离级别',
    };
  }

  /**
   * 在指定隔离级别下读取商品库存，展示快照行为
   *
   * 支持的 level 参数：
   *   READ_UNCOMMITTED / READ_COMMITTED / REPEATABLE_READ / SERIALIZABLE
   *
   * 演示步骤（观察 REPEATABLE READ 与 READ COMMITTED 的区别）：
   *   1. 先调用此接口（level=REPEATABLE_READ），记录返回的 stock
   *   2. 在另一个窗口修改该商品的 stock（直接 PATCH 或 SQL）
   *   3. 再次调用此接口：
   *      - level=READ_COMMITTED  → 看到修改后的新值（不可重复读）
   *      - level=REPEATABLE_READ → 仍看到旧值（快照隔离，不受影响）
   */
  async readWithIsolationLevel(
    productId: string,
    level: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE',
  ): Promise<{
    isolationLevel: string;
    productId: string;
    stock: number;
    snapshotNote: string;
  }> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction(level);

    try {
      const product = await qr.manager.findOne(Product, {
        where: { id: productId },
      });
      if (!product) throw new NotFoundException(`Product #${productId} not found`);

      // 等 2 秒：让外部有时间修改数据，观察当前隔离级别是否"隔离"了这次修改
      await this.sleep(2000);

      // 再读一次，观察同一事务内第二次读是否和第一次相同
      const product2 = await qr.manager.findOne(Product, {
        where: { id: productId },
      });

      await qr.commitTransaction();

      const firstStock = product.stock;
      const secondStock = product2?.stock ?? firstStock;
      const isIsolated = firstStock === secondStock;

      const snapshotNotes: Record<string, string> = {
        'READ UNCOMMITTED': '可读未提交数据，两次读可能因对方未提交的修改而不同',
        'READ COMMITTED': '每次读取最新已提交快照，两次读可能不同（不可重复读）',
        'REPEATABLE READ': 'MVCC 快照隔离，同一事务内两次读结果一致（推荐）',
        SERIALIZABLE: '完全串行，两次读绝对一致，但会阻塞其他写操作',
      };

      return {
        isolationLevel: level,
        productId,
        stock: secondStock,
        snapshotNote: `firstRead=${firstStock}, secondRead=${secondStock}. ${isIsolated ? '✅ 两次一致' : '⚠️ 两次不同（并发异常）'}. ${snapshotNotes[level]}`,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────
  //  阶段四：锁机制演示
  // ─────────────────────────────────────────────

  /**
   * 【演示：共享锁 FOR SHARE】
   *
   * 共享锁允许多个事务同时读同一行，但阻止任何事务对该行加排他锁（写）。
   *
   * 演示：在共享锁下读取商品信息，持锁 2 秒后提交。
   * 并发调用两次：两个请求都能立刻获得共享锁，互不阻塞（读读兼容）。
   */
  async demoSharedLock(productId: string): Promise<{
    lockType: string;
    productId: string;
    stock: number;
    heldForMs: number;
    note: string;
  }> {
    const start = Date.now();
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // FOR SHARE：共享锁，多个事务可同时持有
      const product = await qr.manager
        .createQueryBuilder(Product, 'p')
        .where('p.id = :id', { id: productId })
        .setLock('pessimistic_read') // LOCK IN SHARE MODE
        .getOne();

      if (!product) throw new NotFoundException(`Product #${productId} not found`);

      this.logger.log(
        `[SharedLock] 获得共享锁，stock=${product.stock}，持锁 2 秒...`,
      );

      // 持锁 2 秒，让你观察：另一个并发 FOR SHARE 请求是否会被阻塞
      await this.sleep(2000);

      await qr.commitTransaction();

      return {
        lockType: 'SHARED LOCK (FOR SHARE)',
        productId,
        stock: product.stock,
        heldForMs: Date.now() - start,
        note: '共享锁：并发的 FOR SHARE 请求不会被阻塞（读读兼容）；但 FOR UPDATE 请求会被阻塞（读写互斥）',
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * 【演示：排他锁 FOR UPDATE】
   *
   * 排他锁：同一时间只有一个事务可以持有，其他事务的 FOR UPDATE / FOR SHARE 都要等待。
   *
   * 演示步骤：
   *   1. 同时发起两次请求
   *   2. 第一个请求获得排他锁，持锁 3 秒后提交
   *   3. 第二个请求阻塞等待，直到第一个提交后才能继续
   *   4. 观察两次请求的 heldForMs，第二个会明显更长
   */
  async demoExclusiveLock(productId: string): Promise<{
    lockType: string;
    productId: string;
    stock: number;
    waitedMs: number;
    note: string;
  }> {
    const start = Date.now();
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // FOR UPDATE：排他锁，同一时间只有一个事务能持有
      const product = await qr.manager
        .createQueryBuilder(Product, 'p')
        .where('p.id = :id', { id: productId })
        .setLock('pessimistic_write') // FOR UPDATE
        .getOne();

      if (!product) throw new NotFoundException(`Product #${productId} not found`);

      const waitedMs = Date.now() - start; // 等锁花费的时间
      this.logger.log(
        `[ExclusiveLock] 获得排他锁（等待了 ${waitedMs}ms），stock=${product.stock}，持锁 3 秒...`,
      );

      // 持锁 3 秒，让第二个并发请求在等待
      await this.sleep(3000);

      await qr.commitTransaction();

      return {
        lockType: 'EXCLUSIVE LOCK (FOR UPDATE)',
        productId,
        stock: product.stock,
        waitedMs,
        note:
          waitedMs > 500
            ? `⏳ 等待了 ${waitedMs}ms 才获得锁（说明被前一个事务阻塞了）`
            : `✅ 立刻获得锁（${waitedMs}ms），是第一个请求。排他锁已持有 3 秒，并发请求正在阻塞中`,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * 【演示：死锁】
   *
   * 制造死锁的经典场景：两个事务以相反顺序请求两行的排他锁。
   *
   * 本方法在同一进程内模拟两个并发事务：
   *   事务 A：先锁 productIdA，sleep，再锁 productIdB
   *   事务 B：先锁 productIdB，sleep，再锁 productIdA
   *   ↑ 互相持有对方需要的锁 → 死锁
   *
   * MySQL 检测到死锁后，自动回滚代价更小的事务，
   * 抛出 ER_LOCK_DEADLOCK 错误。
   *
   * 注意：两个 productId 必须是不同的真实商品 ID
   */
  async demoDeadlock(
    productIdA: string,
    productIdB: string,
  ): Promise<{ result: string; winner: string; loser: string }> {
    let winnerLabel = '';
    let loserLabel = '';

    // 启动事务 A 和事务 B，并发执行
    const txA = this.dataSource.transaction(async (managerA) => {
      // A 先锁 productIdA
      await managerA
        .createQueryBuilder(Product, 'p')
        .where('p.id = :id', { id: productIdA })
        .setLock('pessimistic_write')
        .getOne();

      this.logger.warn(`[Deadlock] 事务A 锁定了 productA，等待 300ms 后尝试锁 productB`);
      await this.sleep(300); // 确保事务 B 已锁定 productIdB

      // A 再锁 productIdB（此时 B 持有这个锁，A 等待）
      await managerA
        .createQueryBuilder(Product, 'p')
        .where('p.id = :id', { id: productIdB })
        .setLock('pessimistic_write')
        .getOne();

      winnerLabel = '事务A';
      this.logger.log(`[Deadlock] 事务A 成功提交`);
    });

    const txB = this.dataSource.transaction(async (managerB) => {
      await this.sleep(100); // 稍微延迟，确保 A 先锁 productIdA

      // B 先锁 productIdB
      await managerB
        .createQueryBuilder(Product, 'p')
        .where('p.id = :id', { id: productIdB })
        .setLock('pessimistic_write')
        .getOne();

      this.logger.warn(`[Deadlock] 事务B 锁定了 productB，等待 200ms 后尝试锁 productA`);
      await this.sleep(200); // 确保事务 A 已在等 productIdB

      // B 再锁 productIdA（此时 A 持有这个锁，B 等待 → 死锁！）
      await managerB
        .createQueryBuilder(Product, 'p')
        .where('p.id = :id', { id: productIdA })
        .setLock('pessimistic_write')
        .getOne();

      winnerLabel = '事务B';
      this.logger.log(`[Deadlock] 事务B 成功提交`);
    });

    // 并发执行两个事务，等待其中一个死锁回滚
    const [resultA, resultB] = await Promise.allSettled([txA, txB]);

    const aFailed = resultA.status === 'rejected';
    const bFailed = resultB.status === 'rejected';

    if (!aFailed && !bFailed) {
      return { result: '⚠️ 未触发死锁（两个商品 ID 可能相同，或数据不存在）', winner: '', loser: '' };
    }

    loserLabel = aFailed ? '事务A（被 MySQL 选为回滚目标）' : '事务B（被 MySQL 选为回滚目标）';
    const loserErr = aFailed
      ? (resultA as PromiseRejectedResult).reason
      : (resultB as PromiseRejectedResult).reason;

    this.logger.error(`[Deadlock] 死锁回滚方：${loserLabel}，错误：${loserErr?.message}`);

    return {
      result: '✅ 死锁触发成功！MySQL 自动检测到循环等待，回滚了代价更小的事务',
      winner: winnerLabel || '另一个事务（成功提交）',
      loser: loserLabel,
    };
  }

  // ─────────────────────────────────────────────

  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    Object.assign(order, dto);
    return this.ordersRepo.save(order);
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    await this.ordersRepo.remove(order);
  }
}
