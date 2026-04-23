import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  /** 购买的商品 ID */
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  /** 购买数量，必须为正整数 */
  @IsInt()
  @IsPositive()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  description: string;
}
