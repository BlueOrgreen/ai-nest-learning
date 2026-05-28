import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  NotEquals,
} from 'class-validator';
import { STOCK_ADJUSTMENT_REASONS } from '../entities/stock-adjustment-reason';

const REASON_HINT = STOCK_ADJUSTMENT_REASONS.join(' | ');

export class AdjustStockDto {
  @ApiProperty({ description: '库存变动量，正数入库、负数出库', example: 10 })
  @IsDefined({ message: '缺少必填参数 delta' })
  @IsInt({ message: 'delta 必须为整数' })
  @NotEquals(0, { message: 'delta 不能为 0' })
  delta: number;

  @ApiProperty({
    description: `调整原因（固定枚举，不可自定义文案）。可选值：${REASON_HINT}`,
    example: 'manual',
    enum: STOCK_ADJUSTMENT_REASONS,
  })
  @IsDefined({ message: '缺少必填参数 reason' })
  @IsIn(STOCK_ADJUSTMENT_REASONS, {
    message: `reason 必须是 ${REASON_HINT} 之一，自定义说明请写在 remark`,
  })
  reason: string;

  @ApiProperty({
    description: '操作人用户 ID（须在 user-service 用户表中存在）',
    example: 'a1447362-bce3-48d8-b0fe-26c3307068a1',
  })
  @IsDefined({ message: '缺少必填参数 operatorUserId' })
  @IsUUID('4', { message: 'operatorUserId 必须为合法 UUID' })
  operatorUserId: string;

  @ApiPropertyOptional({
    description: '备注说明（自由文本），如「盘点补货」「修改库存 reason1」',
    example: '这是备注001',
  })
  @IsOptional()
  @IsString({ message: 'remark 必须为字符串' })
  @MaxLength(255, { message: 'remark 最长 255 个字符' })
  remark?: string;
}
