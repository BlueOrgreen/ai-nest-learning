import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { StockAdjustmentLog } from './entities/stock-adjustment-log.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { ProductsSeederService } from './products-seeder.service';
import { UserLookupService } from './user-lookup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, StockAdjustmentLog]),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        timeout: 5000,
        maxRedirects: 2,
      }),
    }),
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    StockAdjustmentsService,
    ProductsSeederService,
    UserLookupService,
  ],
  exports: [ProductsService, StockAdjustmentsService, UserLookupService],
})
export class ProductsModule {}
