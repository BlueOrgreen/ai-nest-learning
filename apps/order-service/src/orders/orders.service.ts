import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
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

  create(dto: CreateOrderDto): Promise<Order> {
    const order = this.ordersRepo.create(dto);
    return this.ordersRepo.save(order);
  }

  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    Object.assign(order, dto);
    return this.ordersRepo.save(order);
  }

  async remove(id: string): Promise<void> {
    // this.logger.debug(`1.[Yunfan-order]-${id}`)
    const order = await this.findOne(id);
    // this.logger.debug(`2.[Yunfan-order]-${order}`)
    await this.ordersRepo.remove(order);
  }
}
