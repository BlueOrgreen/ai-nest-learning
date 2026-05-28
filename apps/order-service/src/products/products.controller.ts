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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { QueryProductCountDto } from './dto/query-product-count.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { BatchStatusDto } from './dto/batch-status.dto';
import { QueryStockLogDto } from './dto/query-stock-log.dto';
import { ProductsService } from './products.service';
import { StockAdjustmentsService } from './stock-adjustments.service';

@ApiTags('商品')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '商品分页列表' })
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findPaginated(query);
  }

  @Get('count')
  @ApiOperation({
    summary: '商品总数',
    description:
      '返回商品数量（默认不含已软删）。仅可选 status、includeDeleted。',
  })
  count(@Query() query: QueryProductCountDto) {
    return this.productsService.count(query);
  }

  @Post('import')
  @ApiOperation({ summary: 'CSV 批量导入商品' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  importProducts(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Query('dryRun') dryRun?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传 CSV 文件（字段名 file）');
    }
    return this.productsService.importFromCsv(file.buffer, dryRun === 'true');
  }

  @Patch('batch-status')
  @ApiOperation({ summary: '批量更新商品上下架状态' })
  batchStatus(@Body() dto: BatchStatusDto) {
    return this.productsService.batchUpdateStatus(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '商品详情' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建商品' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新商品' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '软删除商品' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: '恢复已软删商品' })
  restore(@Param('id') id: string) {
    return this.productsService.restore(id);
  }

  @Post('stock-adjustments/:id')
  @ApiOperation({ summary: '运营手工调整库存' })
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.stockAdjustmentsService.adjust(id, dto);
  }

  @Get('stock-adjustments/logs/:id')
  @ApiOperation({ summary: '库存调整日志（分页）' })
  listStockLogs(@Param('id') id: string, @Query() query: QueryStockLogDto) {
    return this.stockAdjustmentsService.findPaginated(id, query);
  }
}
