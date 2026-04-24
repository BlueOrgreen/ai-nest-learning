import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order } from './entities/order.entity';
import { Product } from '../products/entities/product.entity';

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
  ) {}

  findAll(): Promise<Order[]> {
    return this.ordersRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return order;
  }

  findByUser(userId: string): Promise<Order[]> {
    return this.ordersRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 创建订单 — 写法一：dataSource.transaction()（推荐）
   *
   * 事务保证：扣库存 + 建订单 是原子操作
   *   - 任何一步失败 → 自动 ROLLBACK，库存恢复
   *   - 全部成功    → 自动 COMMIT
   *
   * 注意：事务内必须用回调参数 manager 操作数据库，
   *       不能用 this.ordersRepo（它不在当前事务连接里）
   */
  async create(dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
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
      const order = manager.create(Order, {
        userId: dto.userId,
        productId: dto.productId,
        quantity: dto.quantity,
        description: dto.description,
        amount: Number(product.price) * dto.quantity,
      });
      return manager.save(Order, order);
      // ↑ 回调正常返回 → TypeORM 自动 COMMIT
      // ↑ 任何步骤抛异常 → TypeORM 自动 ROLLBACK
    });
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
