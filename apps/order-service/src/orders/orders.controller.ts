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
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: '获取所有订单（按创建时间倒序）' })
  @ApiResponse({ status: 200, description: '订单列表' })
  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @ApiOperation({ summary: '获取指定用户的所有订单' })
  @ApiParam({ name: 'userId', example: 'uuid-user-yyy', description: '用户 UUID' })
  @ApiResponse({ status: 200, description: '该用户的订单列表' })
  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.ordersService.findByUser(userId);
  }

  // ─────────────────────────────────────────────
  //  阶段二：并发异常演示接口
  //  注意：路由必须在 :id 之前定义，否则 'demo' 会被当成 id 匹配
  // ─────────────────────────────────────────────

  @ApiOperation({
    summary: '【演示】脏读 (Dirty Read)',
    description:
      '配合 POST /orders/demo/simulate-dirty-write 使用。\n先调用写接口（5秒内不提交），再调用此接口，在 READ UNCOMMITTED 级别下可读到未提交数据。',
  })
  @ApiQuery({ name: 'productId', required: true, example: 'uuid-product-xxx', description: '商品 UUID' })
  @ApiResponse({ status: 200, description: '脏读演示结果，含 uncommittedStock 字段' })
  @Get('demo/dirty-read')
  demoDirtyRead(@Query('productId') productId: string) {
    return this.ordersService.demoDirtyRead(productId);
  }

  @ApiOperation({
    summary: '【演示】制造脏写场景（5秒后 ROLLBACK）',
    description: '修改 stock 后暂停 5 秒再 ROLLBACK，制造未提交的脏数据时间窗口。在此期间调用 GET /orders/demo/dirty-read 观察脏读。',
  })
  @ApiBody({ schema: { example: { productId: 'uuid-product-xxx', dirtyStock: 0 } } })
  @ApiResponse({ status: 201, description: '已触发脏写场景（后台等待 5 秒后回滚）' })
  @Post('demo/simulate-dirty-write')
  simulateDirtyWrite(
    @Body('productId') productId: string,
    @Body('dirtyStock') dirtyStock: number,
  ) {
    return this.ordersService.simulateDirtyWrite(productId, dirtyStock);
  }

  @ApiOperation({
    summary: '【演示】不可重复读 (Non-repeatable Read)',
    description: '接口会等待 3 秒。在等待期间修改对应商品 stock 并提交，观察 firstRead 和 secondRead 是否不同。',
  })
  @ApiQuery({ name: 'productId', required: true, example: 'uuid-product-xxx', description: '商品 UUID' })
  @ApiResponse({ status: 200, description: '含 firstRead / secondRead 对比的结果' })
  @Get('demo/non-repeatable-read')
  demoNonRepeatableRead(@Query('productId') productId: string) {
    return this.ordersService.demoNonRepeatableRead(productId);
  }

  @ApiOperation({
    summary: '【演示】幻读 (Phantom Read)',
    description: '接口会等待 3 秒。在等待期间插入该用户的新订单，观察 firstCount 和 secondCount 是否不同。',
  })
  @ApiQuery({ name: 'userId', required: true, example: 'uuid-user-yyy', description: '用户 UUID' })
  @ApiResponse({ status: 200, description: '含 firstCount / secondCount 对比的结果' })
  @Get('demo/phantom-read')
  demoPhantomRead(@Query('userId') userId: string) {
    return this.ordersService.demoPhantomRead(userId);
  }

  @ApiOperation({ summary: '【演示】查询当前 MySQL 会话事务隔离级别' })
  @ApiResponse({ status: 200, description: '当前隔离级别字符串' })
  @Get('demo/isolation-level')
  getSessionIsolationLevel() {
    return this.ordersService.getSessionIsolationLevel();
  }

  @ApiOperation({
    summary: '【演示】在指定隔离级别下读取商品库存（等待 2 秒）',
    description: 'level 使用下划线格式，如 REPEATABLE_READ。接口内部会自动转为 SQL 标准格式（REPEATABLE READ）。',
  })
  @ApiQuery({ name: 'productId', required: true, example: 'uuid-product-xxx' })
  @ApiQuery({
    name: 'level',
    required: false,
    enum: ['READ_UNCOMMITTED', 'READ_COMMITTED', 'REPEATABLE_READ', 'SERIALIZABLE'],
    example: 'REPEATABLE_READ',
    description: '事务隔离级别，默认 REPEATABLE_READ',
  })
  @ApiResponse({ status: 200, description: '含 firstRead / secondRead 及 isolationLevel 的结果' })
  @Get('demo/isolation-level/read')
  readWithIsolationLevel(
    @Query('productId') productId: string,
    @Query('level') level: string,
  ) {
    // 把 URL 参数的下划线格式转成 SQL 标准的空格格式
    const normalized = (level ?? 'REPEATABLE READ').replace(/_/g, ' ') as
      | 'READ UNCOMMITTED'
      | 'READ COMMITTED'
      | 'REPEATABLE READ'
      | 'SERIALIZABLE';
    return this.ordersService.readWithIsolationLevel(productId, normalized);
  }

  // ─────────────────────────────────────────────
  //  阶段四：锁机制演示接口
  // ─────────────────────────────────────────────

  @ApiOperation({
    summary: '【演示】共享锁 FOR SHARE（持锁 2 秒）',
    description: '并发调用两次，两个请求都能立即获得共享锁（读读兼容），waitedMs 均接近 0。',
  })
  @ApiQuery({ name: 'productId', required: true, example: 'uuid-product-xxx' })
  @ApiResponse({ status: 200, description: '含 stock / acquiredAt / waitedMs 的锁演示结果' })
  @Get('demo/lock/shared')
  demoSharedLock(@Query('productId') productId: string) {
    return this.ordersService.demoSharedLock(productId);
  }

  @ApiOperation({
    summary: '【演示】排他锁 FOR UPDATE（持锁 3 秒）',
    description: '并发调用两次，第二个请求被阻塞。观察返回的 waitedMs：第二个请求接近 3000ms。',
  })
  @ApiQuery({ name: 'productId', required: true, example: 'uuid-product-xxx' })
  @ApiResponse({ status: 200, description: '含 stock / acquiredAt / waitedMs 的锁演示结果' })
  @Get('demo/lock/exclusive')
  demoExclusiveLock(@Query('productId') productId: string) {
    return this.ordersService.demoExclusiveLock(productId);
  }

  @ApiOperation({
    summary: '【演示】死锁',
    description:
      '两个事务以相反顺序请求两个商品的排他锁，触发 MySQL 自动死锁检测与回滚。\nproductIdA 和 productIdB 必须是不同的真实商品 UUID。',
  })
  @ApiBody({ schema: { example: { productIdA: 'uuid-product-a', productIdB: 'uuid-product-b' } } })
  @ApiResponse({ status: 201, description: '死锁触发结果，含 winner / loser 信息' })
  @Post('demo/lock/deadlock')
  demoDeadlock(
    @Body('productIdA') productIdA: string,
    @Body('productIdB') productIdB: string,
  ) {
    return this.ordersService.demoDeadlock(productIdA, productIdB);
  }

  // ─────────────────────────────────────────────

  @ApiOperation({ summary: '根据 ID 获取单个订单' })
  @ApiParam({ name: 'id', example: 'uuid-order-zzz', description: '订单 UUID' })
  @ApiResponse({ status: 200, description: '订单详情' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @ApiOperation({ summary: '创建订单（含事务：扣库存 + 建订单）' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, description: '创建成功，返回订单对象' })
  @ApiResponse({ status: 400, description: '库存不足 / 参数校验失败' })
  @ApiResponse({ status: 404, description: '商品或用户不存在' })
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @ApiOperation({ summary: '更新订单信息' })
  @ApiParam({ name: 'id', example: 'uuid-order-zzz' })
  @ApiBody({ type: UpdateOrderDto })
  @ApiResponse({ status: 200, description: '更新后的订单对象' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @ApiOperation({ summary: '删除订单' })
  @ApiParam({ name: 'id', example: 'uuid-order-zzz' })
  @ApiResponse({ status: 204, description: '删除成功，无响应体' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
