import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PRODUCT_STATUSES } from '../entities/product-status';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsInt()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
