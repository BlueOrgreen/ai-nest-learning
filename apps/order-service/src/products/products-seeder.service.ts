import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueryProductDto } from './dto/query-product.dto';
import { ProductsService } from './products.service';

interface SeedProduct {
  name: string;
  price: number;
  stock: number;
}

const SEED_PRODUCTS: SeedProduct[] = [
  { name: '珍珠奶茶', price: 18.0, stock: 100 },
  { name: '芝士奶盖绿茶', price: 22.0, stock: 80 },
  { name: '芋泥波波奶茶', price: 25.0, stock: 60 },
  { name: '杨枝甘露', price: 24.0, stock: 50 },
  { name: '柠檬蜂蜜水', price: 16.0, stock: 120 },
  { name: '茉莉花茶', price: 14.0, stock: 90 },
  { name: '椰果奶茶', price: 20.0, stock: 70 },
  { name: '芒果冰沙', price: 28.0, stock: 40 },
  { name: '红豆芋泥波波', price: 26.0, stock: 55 },
  { name: '抹茶拿铁', price: 23.0, stock: 65 },
];

@Injectable()
export class ProductsSeederService implements OnModuleInit {
  private readonly logger = new Logger(ProductsSeederService.name);

  constructor(private readonly productsService: ProductsService) {}

  async onModuleInit() {
    const query = new QueryProductDto();
    query.page = 1;
    query.pageSize = 1;
    query.includeDeleted = true;
    const { meta } = await this.productsService.findPaginated(query);
    if (meta.total > 0) {
      this.logger.log(`[Seeder] 商品表已有 ${meta.total} 条数据，跳过初始化`);
      return;
    }

    this.logger.log(
      `[Seeder] 商品表为空，开始插入 ${SEED_PRODUCTS.length} 条种子数据...`,
    );

    const saved: string[] = [];
    for (const p of SEED_PRODUCTS) {
      const product = await this.productsService.create(p);
      saved.push(product.id);
      this.logger.debug(`[Seeder] 已插入: ${product.name} (id=${product.id})`);
    }

    this.logger.log(`[Seeder] 完成，共插入 ${saved.length} 条商品`);
  }
}
