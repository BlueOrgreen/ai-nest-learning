-- MySQL dump 10.13  Distrib 9.6.0, for macos14.8 (arm64)
--
-- Host: 127.0.0.1    Database: nest_order_service
-- ------------------------------------------------------
-- Server version	9.6.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_schema_migrations`
--

DROP TABLE IF EXISTS `_schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_schema_migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_schema_migrations_filename` (`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_schema_migrations`
--

LOCK TABLES `_schema_migrations` WRITE;
/*!40000 ALTER TABLE `_schema_migrations` DISABLE KEYS */;
INSERT INTO `_schema_migrations` VALUES (1,'2026-05-20-product-management.sql','2026-05-20 18:13:51.133635'),(2,'2026-05-21-stock-adjustment-operator-user-id.sql','2026-05-25 15:23:04.677486');
/*!40000 ALTER TABLE `_schema_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('pending','paid','shipped','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `productId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES ('02210f3a-d8c4-434d-ba6e-9c0b2f057955','23a371f0-343e-4ef5-abf9-75f3bc73369e','My First Order',99.99,'pending','2026-04-16 17:25:03.225555','',0),('1e59c6e4-d2a4-4db6-89b6-7b047e6878b9','23a371f0-343e-4ef5-abf9-75f3bc73369e','yunfan订单描述03-modify101',60.00,'pending','2026-05-18 10:44:59.507350','033bdd13-a017-4022-81be-acee8c488f73',2),('592b2ad9-3cbc-433b-858f-375627a3f203','23a371f0-343e-4ef5-abf9-75f3bc73369e','yunfan订单备注2',30.00,'pending','2026-05-18 10:38:51.683672','033bdd13-a017-4022-81be-acee8c488f73',1),('88945c56-f88a-46ff-bf29-f189d52a72a6','23a371f0-343e-4ef5-abf9-75f3bc73369e','My First Order 2',199.99,'pending','2026-04-16 17:25:20.869620','',0),('b2a059c4-c107-4463-9cda-c6e7da47e942','23a371f0-343e-4ef5-abf9-75f3bc73369e','yunfan-创建订单-description1',18.00,'pending','2026-05-18 10:34:19.257432','178ea565-ba51-4a02-9c14-d3d865836fac',1),('e66afcc4-1bf0-40b5-aeed-b830a5e5a12f','23a371f0-343e-4ef5-abf9-75f3bc73369e','My First Order 6',30.00,'pending','2026-04-30 10:53:07.631924','984ea835-c11b-4f80-a63f-7baaaf5f8bb3',3),('f6f74b5f-9c3a-492b-9cc0-16571b9fe20c','23a371f0-343e-4ef5-abf9-75f3bc73369e','My First Order 4',300.00,'pending','2026-04-22 16:28:42.057303','',0);
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `status` enum('draft','active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '商品状态',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品描述',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deletedAt` datetime(6) DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES ('033bdd13-a017-4022-81be-acee8c488f73','焦糖玛奇朵1',100.00,32,'active','2121221','2026-05-16 15:48:33.890305','2026-05-25 16:15:28.000000',NULL),('07e05607-af86-4c94-80eb-90a9fff4f4e1','柠檬蜂蜜水',16.00,120,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('0b033beb-38e0-4b9d-b426-b2968620f550','榛果奶茶',22.00,62,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('178ea565-ba51-4a02-9c14-d3d865836fac','薄荷奶绿',18.00,74,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('1afe8f22-5824-4821-a7ec-bda319ca6fdb','测试创建商品2',100.00,100,'inactive','测试创建商品2-描述','2026-05-25 16:18:54.179038','2026-05-25 16:37:47.000000',NULL),('2691f103-f9e9-4434-8455-e20b6b51c980','芝士奶盖绿茶',22.00,80,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('27d51a98-7133-4503-b9e4-0fee12ac45e3','蓝莓奶盖',29.00,40,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('2f26d987-4d50-4f8e-a494-c1bda68b6155','椰果奶茶',20.00,70,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('32fd7793-c3d7-4e3e-8946-21bcbb2eb25d','烧仙草奶茶',20.00,70,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('3594283a-d9d2-4a57-b728-668469763f07','香草拿铁',28.00,40,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('3ad3b76d-9be2-4802-99ee-6e8a1878a27f','杨枝甘露',24.00,50,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('3c232c9a-5204-47c8-a078-3430b4df642e','芒果西米露',24.00,45,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('45813f6f-1d00-4bbb-ba7e-ef6774a6d96c','柠檬绿茶',15.00,100,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('4e8014f1-004b-40a4-812d-dc61b2e1ba90','玫瑰花茶',16.00,90,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('5013db8c-dd07-4e06-a222-84a92d692fc3','茉莉奶绿',17.00,110,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('5b7e14fd-3aab-41e7-83fe-be36c970d473','生椰拿铁',27.00,50,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('5ba6572c-6d7a-47f0-9c81-9d97fc1413d2','红豆芋泥波波',26.00,55,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('5c46af0e-8105-4b01-8ec7-a523cd85bd26','美式咖啡',22.00,60,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('5cac35db-8dba-41ff-96ec-47a1514b29d1','桂花乌龙',18.00,80,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('5f4cdfd3-b56f-46d1-9f28-b31ac6037a9c','椰汁西米露',22.00,50,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('6f6a4c97-bf71-4b30-9623-39971087146b','卡布奇诺',27.00,42,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('72a28890-b78b-48ba-b985-35fd3743f9b2','布丁奶茶',19.00,80,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('75e443e9-4e15-4ea7-8562-75bacf4e80e8','燕麦奶咖',26.00,45,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('846bcfe9-a64d-4575-b644-44e7997756d5','抹茶拿铁',23.00,65,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('8748ea5a-141e-4a66-a0b7-5be9298db548','珍珠奶茶',18.00,100,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('8f0f3029-440a-4196-a68b-23d549802b3f','芋圆奶茶',21.00,65,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('9d05d307-c1ee-4058-a2f6-5afa2de98945','百香果茶',20.00,95,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('a1447362-bce3-48d8-b0fe-26c3307068a1','测试创建商品1',100.00,10100,'inactive',NULL,'2026-05-20 18:51:06.165678','2026-05-25 16:31:57.000000',NULL),('a2237fd5-b778-4882-8c28-64541b1ead6f','茉莉花茶',14.00,90,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('a5088860-0693-43ae-9efb-90a41ea8569a','可可拿铁',26.00,48,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('a588290e-8b18-4573-827a-868e24c1b5df','洛神花茶',13.00,100,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('b6409f13-b20a-422e-9114-9eb4f4da27b5','柚子茶',15.00,130,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('b6e3716f-764e-4f1a-b677-f0d7e33559a3','芒果冰沙',28.00,40,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('c61ff19e-2fc1-4476-9538-0cce55ae0096','摩卡咖啡',29.00,38,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('c740bd8b-db3d-47a4-836a-bf34c6187f63','蜜桃乌龙',19.00,70,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('cc262db8-db4a-4fe0-8b79-a813b98053d7','葡萄芋泥',27.00,35,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('ccec8e5c-8c3e-4254-b989-6666808bb14d','桂圆红枣茶',18.00,55,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('d1da065e-9e28-4000-8b71-69278c90280b','葡萄柚绿',21.00,75,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('db4e5bb1-36bf-414c-aae0-1c23914fc613','乌龙奶茶',19.00,85,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('e92c1f96-fbf9-4a6d-83c1-1c3482b7690c','红枣姜茶',17.00,60,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('ef08b3c0-96d7-46c1-96e7-73fbd52e4b9a','抹茶奶茶',21.00,68,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL),('efbd9d46-53ac-470d-9f3a-2a884750f7b5','芋泥波波奶茶',25.00,60,'active',NULL,'2026-05-16 15:48:33.890305','2026-05-20 18:13:51.088963',NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_adjustment_logs`
--

DROP TABLE IF EXISTS `stock_adjustment_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_adjustment_logs` (
  `id` char(36) NOT NULL,
  `productId` varchar(36) NOT NULL,
  `delta` int NOT NULL COMMENT '变动量，正=入库负=出库',
  `stockBefore` int NOT NULL,
  `stockAfter` int NOT NULL,
  `reason` enum('manual','order','batch_import','correction') NOT NULL,
  `remark` varchar(255) DEFAULT NULL,
  `operatorUserId` varchar(36) DEFAULT NULL COMMENT '操作人用户ID（逻辑关联 user-service.users，无外键）',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_stock_adjustment_logs_productId` (`productId`),
  KEY `IDX_stock_adjustment_logs_createdAt` (`createdAt`),
  KEY `IDX_stock_adjustment_logs_operatorUserId` (`operatorUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_adjustment_logs`
--

LOCK TABLES `stock_adjustment_logs` WRITE;
/*!40000 ALTER TABLE `stock_adjustment_logs` DISABLE KEYS */;
INSERT INTO `stock_adjustment_logs` VALUES ('9f36a9fc-f62a-477e-95af-815508be5d99','a1447362-bce3-48d8-b0fe-26c3307068a1',99,10000,10099,'manual','这是备注001',NULL,'2026-05-20 19:06:29.722281'),('fdc4b466-bee8-4adc-84c2-bd3d5c750756','a1447362-bce3-48d8-b0fe-26c3307068a1',1,10099,10100,'manual','这是备注001','23a371f0-343e-4ef5-abf9-75f3bc73369e','2026-05-25 15:35:32.051933');
/*!40000 ALTER TABLE `stock_adjustment_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'nest_order_service'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-28 15:50:38
