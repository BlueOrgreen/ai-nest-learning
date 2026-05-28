import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { STOCK_ADJUSTMENT_REASONS } from './stock-adjustment-reason';

@Entity('stock_adjustment_logs')
export class StockAdjustmentLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 36 })
  productId: string;

  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'int' })
  stockBefore: number;

  @Column({ type: 'int' })
  stockAfter: number;

  @Column({
    type: 'enum',
    enum: STOCK_ADJUSTMENT_REASONS,
  })
  reason: (typeof STOCK_ADJUSTMENT_REASONS)[number];

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark: string | null;

  /** 操作人（逻辑关联 user-service.users.id，库级无外键） */
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  operatorUserId: string | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
