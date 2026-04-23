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
