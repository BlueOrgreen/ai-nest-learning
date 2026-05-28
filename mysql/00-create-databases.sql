-- 创建业务库（与 apps/user-service、apps/order-service 的 DB_DATABASE 一致）
CREATE DATABASE IF NOT EXISTS nest_user_service
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS nest_order_service
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
