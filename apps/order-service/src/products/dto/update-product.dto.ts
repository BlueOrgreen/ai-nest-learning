import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PRODUCT_STATUSES } from '../entities/product-status';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
