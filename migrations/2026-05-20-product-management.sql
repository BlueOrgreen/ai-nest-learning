-- 商品管理模块 schema 升级
-- 适用：order-service 使用的 MySQL 库（如 nest_order_service）
-- 执行前请先备份；生产环境在维护窗口、先备份再执行
--
-- 执行示例：
--   mysql -h 127.0.0.1 -u root -p nest_order_service < migrations/2026-05-20-product-management.sql

-- ── 1. products 表新增字段 ─────────────────────────────
ALTER TABLE `products`
  ADD COLUMN `status` ENUM('draft', 'active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '商品状态' AFTER `stock`,
  ADD COLUMN `description` VARCHAR(500) NULL COMMENT '商品描述' AFTER `status`,
  ADD COLUMN `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) AFTER `createdAt`,
  ADD COLUMN `deletedAt` DATETIME(6) NULL COMMENT '软删除时间' AFTER `updatedAt`;

-- 已有数据：统一设为可售（若列已存在可跳过本句）
UPDATE `products` SET `status` = 'active' WHERE `status` IS NULL OR `status` = '';

-- ── 2. 库存调整日志表 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS `stock_adjustment_logs` (
  `id` char(36) NOT NULL,
  `productId` varchar(36) NOT NULL,
  `delta` int NOT NULL COMMENT '变动量，正=入库负=出库',
  `stockBefore` int NOT NULL,
  `stockAfter` int NOT NULL,
  `reason` ENUM('manual', 'order', 'batch_import', 'correction') NOT NULL,
  `remark` varchar(255) NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_stock_adjustment_logs_productId` (`productId`),
  KEY `IDX_stock_adjustment_logs_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
