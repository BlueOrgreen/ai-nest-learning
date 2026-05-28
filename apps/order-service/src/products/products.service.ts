import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { QueryProductCountDto } from './dto/query-product-count.dto';
import { BatchStatusDto } from './dto/batch-status.dto';
import { Product } from './entities/product.entity';
import { ProductStatus } from './entities/product-status';
import { StockAdjustmentLog } from './entities/stock-adjustment-log.entity';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { parseProductCsv } from './utils/parse-product-csv';

const MAX_IMPORT_ROWS = 100;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  private applyListFilters(
    qb: SelectQueryBuilder<Product>,
    filters: {
      keyword?: string;
      status?: string;
      minStock?: number;
      maxStock?: number;
      includeDeleted?: boolean;
    },
  ): void {
    if (filters.includeDeleted) {
      qb.withDeleted();
    }

    const keyword = filters.keyword?.trim();
    if (keyword) {
      qb.andWhere('product.name LIKE :keyword', { keyword: `%${keyword}%` });
    }

    if (filters.status) {
      qb.andWhere('product.status = :status', { status: filters.status });
    }

    if (filters.minStock !== undefined) {
      qb.andWhere('product.stock >= :minStock', {
        minStock: filters.minStock,
      });
    }

    if (filters.maxStock !== undefined) {
      qb.andWhere('product.stock <= :maxStock', {
        maxStock: filters.maxStock,
      });
    }
  }

  async count(dto: QueryProductCountDto) {
    const qb = this.productsRepo.createQueryBuilder('product');
    this.applyListFilters(qb, dto);
    const total = await qb.getCount();
    return { total };
  }

  async findPaginated(dto: QueryProductDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const sortBy = dto.sortBy?.trim() || 'createdAt';
    const sortOrder = dto.sortOrder?.trim() || 'desc';
    const skip = (page - 1) * pageSize;

    const qb = this.productsRepo.createQueryBuilder('product');
    this.applyListFilters(qb, dto);

    const total = await qb.getCount();

    qb.orderBy(`product.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(pageSize);

    const data = await qb.getMany();

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

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  create(dto: CreateProductDto): Promise<Product> {
    const product = this.productsRepo.create({
      name: dto.name,
      price: dto.price,
      stock: dto.stock,
      status: (dto.status ?? 'active') as Product['status'],
      description: dto.description ?? null,
    });
    return this.productsRepo.save(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, dto);
    if (dto.description === undefined) {
      // keep existing
    } else if (dto.description === null) {
      product.description = null;
    }
    return this.productsRepo.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productsRepo.softRemove(product);
  }

  async restore(id: string): Promise<Product> {
    const product = await this.productsRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    if (!product.deletedAt) {
      throw new BadRequestException(`Product #${id} 未被删除，无需恢复`);
    }
    await this.productsRepo.restore(id);
    return this.findOne(id);
  }

  async batchUpdateStatus(dto: BatchStatusDto) {
    const notFound: string[] = [];
    let updated = 0;

    for (const id of dto.ids) {
      const product = await this.productsRepo.findOne({ where: { id } });
      if (!product) {
        notFound.push(id);
        continue;
      }
      product.status = dto.status as Product['status'];
      await this.productsRepo.save(product);
      updated++;
    }

    return { updated, notFound };
  }

  async importFromCsv(fileBuffer: Buffer, dryRun = false) {
    const content = fileBuffer.toString('utf-8');
    const parsed = parseProductCsv(content);
    if ('message' in parsed) {
      throw new BadRequestException(parsed.message);
    }

    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `单次导入最多 ${MAX_IMPORT_ROWS} 行数据，当前 ${parsed.rows.length} 行`,
      );
    }

    const created: Array<{ id: string; name: string; row: number }> = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (const row of parsed.rows) {
      const validationError = await this.validateImportRow(row);
      if (validationError) {
        errors.push({ row: row.row, message: validationError });
        continue;
      }

      if (dryRun) {
        created.push({ id: '', name: row.name, row: row.row });
        continue;
      }

      try {
        const product = await this.productsRepo.manager.transaction(
          async (manager) => {
            const entity = manager.create(Product, {
              name: row.name,
              price: row.price,
              stock: row.stock,
              status: (row.status as ProductStatus) ?? 'active',
              description: row.description ?? null,
            });
            const saved = await manager.save(Product, entity);
            if (row.stock > 0) {
              await manager.save(StockAdjustmentLog, {
                productId: saved.id,
                delta: row.stock,
                stockBefore: 0,
                stockAfter: row.stock,
                reason: 'batch_import',
                remark: `CSV 导入（行 ${row.row}）`,
                operatorUserId: null,
              });
            }
            return saved;
          },
        );
        created.push({ id: product.id, name: product.name, row: row.row });
      } catch (err) {
        const message = err instanceof Error ? err.message : '导入失败';
        errors.push({ row: row.row, message });
      }
    }

    return {
      summary: {
        total: parsed.rows.length,
        created: created.length,
        failed: errors.length,
        dryRun,
      },
      created,
      errors,
    };
  }

  private async validateImportRow(row: {
    row: number;
    name: string;
    price: number;
    stock: number;
    status?: string;
    description?: string;
  }): Promise<string | null> {
    const dto = plainToInstance(CreateProductDto, {
      name: row.name,
      price: Number.isNaN(row.price) ? -1 : row.price,
      stock: Number.isNaN(row.stock) ? -1 : row.stock,
      status: row.status,
      description: row.description,
    });
    const validationErrors = await validate(dto);
    if (validationErrors.length > 0) {
      const messages = validationErrors
        .flatMap((e) => Object.values(e.constraints ?? {}))
        .join('; ');
      return messages || '校验失败';
    }
    return null;
  }

  /** 下单前校验：存在、未删、可售 */
  assertSellable(product: Product | null, productId: string): Product {
    if (!product) {
      throw new NotFoundException(`Product #${productId} not found`);
    }
    if (product.deletedAt) {
      throw new BadRequestException(`商品 "${product.name}" 已删除，不可下单`);
    }
    if (product.status !== 'active') {
      throw new BadRequestException(
        `商品 "${product.name}" 状态为 ${product.status}，不可下单`,
      );
    }
    return product;
  }
}
