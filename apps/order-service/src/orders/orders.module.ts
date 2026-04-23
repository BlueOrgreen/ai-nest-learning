import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    // 注意：阶段一开始，OrdersService.create() 改用 dataSource.transaction()
    // 事务内通过 manager 直接操作 Product，不再依赖 ProductsService
    // 因此移除了对 ProductsModule 的依赖
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
