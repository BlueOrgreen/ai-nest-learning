import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  Min,
  Max,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { PRODUCT_STATUSES } from '../entities/product-status';

export class QueryProductDto {
  @IsOptional()
  @Type(() => Number) // ② 再转型
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number) // ② 再转型
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @IsString()
  keyword?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @IsString()
  @IsIn(['createdAt', 'price', 'name', 'stock', 'updatedAt'])
  sortBy?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @IsString()
  @IsIn(PRODUCT_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStock?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDeleted?: boolean;
}
