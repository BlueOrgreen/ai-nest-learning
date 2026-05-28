import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { PRODUCT_STATUSES } from '../entities/product-status';

/** 商品总数：仅可选 status、includeDeleted */
export class QueryProductCountDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @IsString()
  @IsIn(PRODUCT_STATUSES)
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDeleted?: boolean;
}
