export type StockAdjustmentReason =
  | 'manual'
  | 'order'
  | 'batch_import'
  | 'correction';

export const STOCK_ADJUSTMENT_REASONS: StockAdjustmentReason[] = [
  'manual',
  'order',
  'batch_import',
  'correction',
];
