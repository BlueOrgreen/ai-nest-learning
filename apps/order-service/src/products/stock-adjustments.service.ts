import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryStockLogDto } from './dto/query-stock-log.dto';
import { Product } from './entities/product.entity';
import { StockAdjustmentLog } from './entities/stock-adjustment-log.entity';
import { StockAdjustmentReason } from './entities/stock-adjustment-reason';
import { UserLookupService } from './user-lookup.service';

@Injectable()
export class StockAdjustmentsService {
  constructor(
    @InjectRepository(StockAdjustmentLog)
    private readonly logsRepo: Repository<StockAdjustmentLog>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    private readonly userLookup: UserLookupService,
  ) {}

  async adjust(productId: string, dto: AdjustStockDto) {
    await this.userLookup.assertUserExists(dto.operatorUserId);

    return this.productsRepo.manager.transaction(async (manager) => {
      const product = await this.findActiveProduct(manager, productId);
      return this.applyDelta(
        manager,
        product,
        dto.delta,
        dto.reason as StockAdjustmentReason,
        dto.operatorUserId,
        dto.remark,
      );
    });
  }

  async recordWithManager(
    manager: EntityManager,
    product: Product,
    delta: number,
    reason: StockAdjustmentReason,
    operatorUserId: string | null,
    remark?: string,
  ): Promise<StockAdjustmentLog> {
    const stockBefore = product.stock;
    const stockAfter = stockBefore + delta;
    if (stockAfter < 0) {
      throw new BadRequestException(
        `库存不足：当前 ${stockBefore}，变动 ${delta}`,
      );
    }

    product.stock = stockAfter;
    await manager.save(Product, product);

    const log = manager.create(StockAdjustmentLog, {
      productId: product.id,
      delta,
      stockBefore,
      stockAfter,
      reason,
      remark: remark ?? null,
      operatorUserId,
    });
    return manager.save(StockAdjustmentLog, log);
  }

  private async applyDelta(
    manager: EntityManager,
    product: Product,
    delta: number,
    reason: StockAdjustmentReason,
    operatorUserId: string,
    remark?: string,
  ) {
    if (delta === 0) {
      throw new BadRequestException('delta 不能为 0');
    }
    const log = await this.recordWithManager(
      manager,
      product,
      delta,
      reason,
      operatorUserId,
      remark,
    );
    return { product, log };
  }

  private async findActiveProduct(manager: EntityManager, productId: string) {
    const product = await manager.findOne(Product, {
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product #${productId} not found`);
    }
    return product;
  }

  async findPaginated(productId: string, dto: QueryStockLogDto) {
    await this.ensureProductExists(productId);

    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [data, total] = await this.logsRepo.findAndCount({
      where: { productId },
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private async ensureProductExists(productId: string) {
    const exists = await this.productsRepo.findOne({
      where: { id: productId },
      withDeleted: true,
    });
    if (!exists) {
      throw new NotFoundException(`Product #${productId} not found`);
    }
  }
}
