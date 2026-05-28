-- 首次初始化 MySQL 数据卷时创建两个业务库（与本地 apps/*/.env 一致）
CREATE DATABASE IF NOT EXISTS nest_user_service
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS nest_order_service
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
