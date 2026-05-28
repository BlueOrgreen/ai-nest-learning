import { ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';
import { PRODUCT_STATUSES } from '../entities/product-status';

export class BatchStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  @IsIn(PRODUCT_STATUSES)
  status: string;
}
