import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsIn,
  Min,
  Max,
  ValidateIf,
  IsNumber,
} from 'class-validator';

export class QueryOrderDto {
  @IsOptional()
  // @ValidateIf((o, v) => v !== undefined && v !== '' && !isNaN(Number(v)))
  @Type(() => Number) // ② 再转型
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  // @ValidateIf((o, v) => v !== undefined && v !== '' && !isNaN(Number(v)))
  @Type(() => Number) // ② 再转型
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== '')
  @IsString()
  userId?: string;

  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== '')
  @IsString()
  status?: string;

  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== '')
  @IsString()
  sortBy?: string;

  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== '')
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
