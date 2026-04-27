import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateOrderDto {
  @ApiPropertyOptional({ example: '修改备注', description: '订单备注' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 99.9, description: '订单金额（保留两位小数）' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    example: 'paid',
    enum: ['pending', 'paid', 'shipped', 'completed', 'cancelled'],
    description: '订单状态',
  })
  @IsEnum(['pending', 'paid', 'shipped', 'completed', 'cancelled'])
  @IsOptional()
  status?: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
}
