# Step 1: 改造为 NestJS Monorepo 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将标准 NestJS 单应用项目改造为 Monorepo，包含 gateway、user-service、order-service 三个独立应用。

**Architecture:** NestJS 原生 Monorepo 模式，所有应用放在 `apps/` 目录下，共享库放在 `libs/` 目录下，通过 `nest-cli.json` 的 `projects` 字段管理各应用的编译配置。

**Tech Stack:** NestJS v11、@nestjs/cli（nest g app / nest g lib）

---

## Task 1: 修改 nest-cli.json 为 Monorepo 模式

**Files:**
- Modify: `nest-cli.json`

**Step 1: 将 nest-cli.json 改写为 monorepo 格式**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/gateway/src",
  "monorepo": true,
  "root": "apps/gateway",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": false,
    "tsConfigPath": "apps/gateway/tsconfig.app.json"
  },
  "projects": {
    "gateway": {
      "type": "application",
      "root": "apps/gateway",
      "entryFile": "main",
      "sourceRoot": "apps/gateway/src",
      "compilerOptions": {
        "tsConfigPath": "apps/gateway/tsconfig.app.json"
      }
    },
    "user-service": {
      "type": "application",
      "root": "apps/user-service",
      "entryFile": "main",
      "sourceRoot": "apps/user-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/user-service/tsconfig.app.json"
      }
    },
    "order-service": {
      "type": "application",
      "root": "apps/order-service",
      "entryFile": "main",
      "sourceRoot": "apps/order-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/order-service/tsconfig.app.json"
      }
    }
  }
}
```

**Step 2: 确认文件写入正确**

检查 `nest-cli.json`，确认 `monorepo: true` 字段存在。

---

## Task 2: 迁移现有 src/ 到 apps/gateway/src/

**Files:**
- Create: `apps/gateway/src/main.ts`
- Create: `apps/gateway/src/app.module.ts`
- Create: `apps/gateway/src/app.controller.ts`
- Create: `apps/gateway/src/app.controller.spec.ts`
- Create: `apps/gateway/src/app.service.ts`
- Create: `apps/gateway/tsconfig.app.json`
- Delete: `src/` 目录下所有文件（迁移完成后）

**Step 1: 创建 apps/gateway/src/ 目录结构，复制现有文件**

`apps/gateway/src/main.ts`（端口改为 3000）:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
  console.log('Gateway is running on port 3000');
}
bootstrap();
```

`apps/gateway/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

`apps/gateway/src/app.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

`apps/gateway/src/app.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Gateway Service is running!';
  }
}
```

`apps/gateway/src/app.controller.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Gateway Service is running!"', () => {
      expect(appController.getHello()).toBe('Gateway Service is running!');
    });
  });
});
```

**Step 2: 创建 apps/gateway/tsconfig.app.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/gateway"
  },
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

---

## Task 3: 创建 user-service 骨架

**Files:**
- Create: `apps/user-service/src/main.ts`
- Create: `apps/user-service/src/app.module.ts`
- Create: `apps/user-service/src/app.controller.ts`
- Create: `apps/user-service/src/app.service.ts`
- Create: `apps/user-service/tsconfig.app.json`

**Step 1: 创建 user-service 入口**

`apps/user-service/src/main.ts`（端口 3001）:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
  console.log('User Service is running on port 3001');
}
bootstrap();
```

`apps/user-service/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

`apps/user-service/src/app.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health(): string {
    return this.appService.getHello();
  }
}
```

`apps/user-service/src/app.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'User Service is running!';
  }
}
```

`apps/user-service/tsconfig.app.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/user-service"
  },
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

---

## Task 4: 创建 order-service 骨架

**Files:**
- Create: `apps/order-service/src/main.ts`
- Create: `apps/order-service/src/app.module.ts`
- Create: `apps/order-service/src/app.controller.ts`
- Create: `apps/order-service/src/app.service.ts`
- Create: `apps/order-service/tsconfig.app.json`

**Step 1: 创建 order-service 入口**

`apps/order-service/src/main.ts`（端口 3002）:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3002);
  console.log('Order Service is running on port 3002');
}
bootstrap();
```

`apps/order-service/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

`apps/order-service/src/app.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health(): string {
    return this.appService.getHello();
  }
}
```

`apps/order-service/src/app.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Order Service is running!';
  }
}
```

`apps/order-service/tsconfig.app.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/order-service"
  },
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

---

## Task 5: 更新根级配置文件

**Files:**
- Modify: `tsconfig.json`（添加 paths 别名支持）
- Modify: `package.json`（添加各服务启动脚本）

**Step 1: 更新 tsconfig.json 支持 paths**

在 `compilerOptions` 中添加：
```json
"paths": {
  "@app/common": ["libs/common/src"],
  "@app/common/*": ["libs/common/src/*"]
}
```

**Step 2: 更新 package.json scripts**

添加各服务独立启动脚本：
```json
"start:gateway": "nest start gateway --watch",
"start:user": "nest start user-service --watch",
"start:order": "nest start order-service --watch"
```

---

## Task 6: 清理旧 src/ 目录 + 验证构建

**Step 1: 删除旧的 src/ 目录**（迁移已完成，不再需要）

**Step 2: 验证 gateway 可编译**

```bash
npx nest build gateway
```
期望：编译成功，`dist/apps/gateway/` 目录生成

**Step 3: git commit**

```bash
git add -A
git commit -m "feat(step-1): 改造为 NestJS Monorepo，创建 gateway/user-service/order-service"
```
