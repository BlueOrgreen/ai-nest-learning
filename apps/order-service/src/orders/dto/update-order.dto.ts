import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateOrderDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  amount?: number;

  @IsEnum(['pending', 'paid', 'shipped', 'completed', 'cancelled'])
  @IsOptional()
  status?: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
}
