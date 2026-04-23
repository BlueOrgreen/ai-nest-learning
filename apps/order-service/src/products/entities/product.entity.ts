import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Product 实体
 *
 * 用于演示事务与锁的业务场景："下单扣库存"
 *
 * 核心字段：stock（库存）
 *   - 阶段一：无事务时，扣库存和创建订单可能出现数据不一致
 *   - 阶段四：悲观锁 SELECT ... FOR UPDATE 防止并发超卖
 *   - 阶段五：乐观锁 @Version 检测并发冲突
 */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  /**
   * 库存数量
   * 下单时执行：stock = stock - quantity
   * 必须 >= 0，不能超卖
   */
  @Column({ type: 'int', default: 0 })
  stock: number;

  @CreateDateColumn()
  createdAt: Date;
}
