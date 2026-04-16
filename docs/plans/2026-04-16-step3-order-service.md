# Step 3: 实现 order-service 订单接口 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 order-service 中实现完整的订单 CRUD REST 接口，使用 MySQL + TypeORM 持久化，订单与用户通过 userId 关联（不做外键约束，保持服务独立性）。

**Architecture:** 与 user-service 保持一致的三层结构，Order 实体记录 userId（字符串引用，非外键），服务间解耦。

**Tech Stack:** NestJS v11、@nestjs/typeorm、typeorm、mysql2、class-validator

---

## 数据库信息

| 项目 | 值 |
|------|----|
| host | localhost |
| port | 3306 |
| username | root |
| password | （空） |
| database | nest_order_service |

---

## 订单状态流转

```
pending → paid → shipped → completed
                         ↘ cancelled
```

---

## 接口设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /orders | 获取所有订单 |
| GET | /orders/:id | 获取单个订单 |
| GET | /orders/user/:userId | 获取某用户的所有订单 |
| POST | /orders | 创建订单 |
| PATCH | /orders/:id | 更新订单（状态/金额） |
| DELETE | /orders/:id | 删除订单 |

---

## Task 1: Order 实体 + DTO

**Files:**
- Create: `apps/order-service/src/orders/entities/order.entity.ts`
- Create: `apps/order-service/src/orders/dto/create-order.dto.ts`
- Create: `apps/order-service/src/orders/dto/update-order.dto.ts`

字段：id（uuid）、userId（string）、description、amount（decimal）、status（enum）、createdAt。

---

## Task 2: OrdersService

**Files:**
- Create: `apps/order-service/src/orders/orders.service.ts`

方法：findAll / findOne / findByUser / create / update / remove

---

## Task 3: OrdersController + OrdersModule

**Files:**
- Create: `apps/order-service/src/orders/orders.controller.ts`
- Create: `apps/order-service/src/orders/orders.module.ts`

---

## Task 4: AppModule 接入 TypeORM + main.ts 启用 ValidationPipe

**Files:**
- Modify: `apps/order-service/src/app.module.ts`
- Modify: `apps/order-service/src/main.ts`

---

## Task 5: 验证构建 + commit

```bash
npx nest build order-service
git add -A
git commit -m "feat(step-3): 实现 order-service 订单接口（MySQL + TypeORM）"
```
