import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order } from './entities/order.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly productsService: ProductsService,
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
   * 创建订单（阶段零版本：故意不加事务）
   *
   * 流程：
   *   1. 查询商品是否存在
   *   2. 检查库存是否充足
   *   3. 扣减库存（stock - quantity）
   *   4. 创建订单记录
   *
   * ⚠️  WARNING: 此处故意不加事务，为阶段一的学习埋下伏笔。
   *   如果第 4 步失败，库存已经扣减但订单未创建 → 数据不一致！
   *   阶段一将用事务修复这个问题。
   */
  async create(dto: CreateOrderDto): Promise<Order> {
    // 1. 查询商品
    const product = await this.productsService.findOne(dto.productId);

    // 2. 检查库存
    if (product.stock < dto.quantity) {
      throw new BadRequestException(
        `库存不足：商品 "${product.name}" 当前库存 ${product.stock}，需要 ${dto.quantity}`,
      );
    }

    // 3. 扣减库存（⚠️ 无事务：若第 4 步抛异常，此处已执行的扣减不会回滚）
    await this.productsService.update(product.id, {
      stock: product.stock - dto.quantity,
    });

    // 4. 创建订单
    const order = this.ordersRepo.create({
      userId: dto.userId,
      productId: dto.productId,
      quantity: dto.quantity,
      description: dto.description,
      amount: Number(product.price) * dto.quantity,
    });
    return this.ordersRepo.save(order);
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
