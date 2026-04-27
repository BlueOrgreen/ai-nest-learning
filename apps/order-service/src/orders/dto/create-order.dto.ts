import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'uuid-user-yyy', description: '用户 ID（UUID）' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  /** 购买的商品 ID */
  @ApiProperty({ example: 'uuid-product-xxx', description: '商品 ID（UUID）' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  /** 购买数量，必须为正整数 */
  @ApiProperty({ example: 2, description: '购买数量，必须为正整数（>= 1）' })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({ example: '生日礼物', description: '订单备注（可选）' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
