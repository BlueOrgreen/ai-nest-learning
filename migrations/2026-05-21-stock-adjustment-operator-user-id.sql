-- 库存调整日志：记录操作人 userId
-- 适用：nest_order_service
-- 本地：pnpm migrate:local

ALTER TABLE `stock_adjustment_logs`
  ADD COLUMN `operatorUserId` varchar(36) NULL COMMENT '操作人用户ID（逻辑关联 user-service.users，无外键）' AFTER `remark`,
  ADD KEY `IDX_stock_adjustment_logs_operatorUserId` (`operatorUserId`);
