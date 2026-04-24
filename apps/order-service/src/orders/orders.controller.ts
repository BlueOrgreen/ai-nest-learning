import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.ordersService.findByUser(userId);
  }

  // ─────────────────────────────────────────────
  //  阶段二：并发异常演示接口
  //  注意：路由必须在 :id 之前定义，否则 'demo' 会被当成 id 匹配
  // ─────────────────────────────────────────────

  /**
   * 演示脏读
   * 使用方式：先调用 POST /orders/demo/simulate-dirty-write，
   *          5 秒内再调用此接口
   * GET /orders/demo/dirty-read?productId=xxx
   */
  @Get('demo/dirty-read')
  demoDirtyRead(@Query('productId') productId: string) {
    return this.ordersService.demoDirtyRead(productId);
  }

  /**
   * 制造脏写场景（配合脏读演示）
   * POST /orders/demo/simulate-dirty-write
   * body: { "productId": "xxx", "dirtyStock": 0 }
   */
  @Post('demo/simulate-dirty-write')
  simulateDirtyWrite(
    @Body('productId') productId: string,
    @Body('dirtyStock') dirtyStock: number,
  ) {
    return this.ordersService.simulateDirtyWrite(productId, dirtyStock);
  }

  /**
   * 演示不可重复读（接口会等待 3 秒）
   * 调用后，在 3 秒内修改对应商品的 stock，观察两次读取结果是否不同
   * GET /orders/demo/non-repeatable-read?productId=xxx
   */
  @Get('demo/non-repeatable-read')
  demoNonRepeatableRead(@Query('productId') productId: string) {
    return this.ordersService.demoNonRepeatableRead(productId);
  }

  /**
   * 演示幻读（接口会等待 3 秒）
   * 调用后，在 3 秒内插入该用户的新订单，观察两次统计结果是否不同
   * GET /orders/demo/phantom-read?userId=xxx
   */
  @Get('demo/phantom-read')
  demoPhantomRead(@Query('userId') userId: string) {
    return this.ordersService.demoPhantomRead(userId);
  }

  // ─────────────────────────────────────────────

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}

