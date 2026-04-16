# Step 2: 实现 user-service CRUD 接口 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 user-service 中实现完整的用户 CRUD REST 接口，使用 MySQL + TypeORM 持久化数据。

**Architecture:** 标准 NestJS 三层结构（Controller → Service → TypeORM Repository），数据库为 MySQL，TypeORM 自动同步表结构（synchronize: true，仅学习环境使用）。

**Tech Stack:** NestJS v11、@nestjs/typeorm、typeorm、mysql2、class-validator、uuid

---

## 数据库信息

| 项目 | 值 |
|------|----|
| host | localhost |
| port | 3306 |
| username | root |
| password | （空） |
| database | nest_user_service |

---

## 接口设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /users | 获取所有用户 |
| GET | /users/:id | 获取单个用户 |
| POST | /users | 创建用户 |
| PATCH | /users/:id | 更新用户 |
| DELETE | /users/:id | 删除用户 |

---

## Task 1: User 实体（TypeORM Entity）

**Files:**
- Create: `apps/user-service/src/users/entities/user.entity.ts`

使用 TypeORM 装饰器定义表结构：id（uuid）、name、email（唯一）、role（enum）、createdAt。

---

## Task 2: CreateUserDto / UpdateUserDto

**Files:**
- Create: `apps/user-service/src/users/dto/create-user.dto.ts`
- Create: `apps/user-service/src/users/dto/update-user.dto.ts`

使用 class-validator 装饰器做字段校验。

---

## Task 3: UsersService（TypeORM Repository）

**Files:**
- Create: `apps/user-service/src/users/users.service.ts`

注入 `Repository<User>`，实现 findAll / findOne / create / update / remove。

---

## Task 4: UsersController

**Files:**
- Create: `apps/user-service/src/users/users.controller.ts`

路由前缀 `/users`，启用全局 ValidationPipe。

---

## Task 5: UsersModule + AppModule 接入 TypeORM

**Files:**
- Create: `apps/user-service/src/users/users.module.ts`
- Modify: `apps/user-service/src/app.module.ts`（接入 TypeOrmModule.forRoot）
- Modify: `apps/user-service/src/main.ts`（启用 ValidationPipe）

---

## Task 6: 验证构建 + commit

```bash
npx nest build user-service
git add -A
git commit -m "feat(step-2): 实现 user-service CRUD 接口（MySQL + TypeORM）"
```
