import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  userId: string;

  /**
   * 关联商品 ID（逻辑关联，不加数据库外键约束）
   * 微服务架构中跨服务数据一致性由业务层保证，而非数据库约束
   */
  @Column({ length: 36 })
  productId: string;

  /** 购买数量 */
  @Column({ type: 'int' })
  quantity: number;

  @Column({ length: 500 })
  description: string;

  /** 订单总金额 = 商品单价 × 数量（下单时计算并固定，不随商品价格变动） */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'shipped', 'completed', 'cancelled'],
    default: 'pending',
  })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;
}
