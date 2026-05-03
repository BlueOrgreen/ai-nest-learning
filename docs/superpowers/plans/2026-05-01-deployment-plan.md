# 部署实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 NestJS 微服务 + Next.js 前端部署到腾讯云轻量服务器，通过 Nginx 反向代理 + Docker 容器管理

**Architecture:** Monorepo 结构，根目录通过 docker-compose 管理所有服务。Nginx 作为反向代理，根据子域名分流到不同服务。

**Tech Stack:** Docker, Docker Compose, Nginx, Let's Encrypt (certbot), MySQL 8.0, Next.js, NestJS

---

## 文件结构

```
my-firstnest/
├── docker-compose.yml          # 主编排文件
├── nginx/
│   ├── conf.d/
│   │   ├── api.chenchar.com.conf
│   │   └── admin.chenchar.com.conf
│   └── ssl/                     # SSL 证书目录
├── .env                         # 环境变量
├── apps/
│   ├── gateway/                 # NestJS 网关 (已有)
│   ├── user-service/            # NestJS 用户服务 (已有)
│   └── order-service/           # NestJS 订单服务 (已有)
└── frontend/                    # Next.js 前端 (需新建)
```

---

## Task 1: 创建 docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: 创建 docker-compose.yml**

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - gateway
      - nextjs
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

  gateway:
    build:
      context: .
      dockerfile: apps/gateway/Dockerfile
    environment:
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - DB_NAME=${MYSQL_DATABASE}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mysql
    restart: unless-stopped

  user-service:
    build:
      context: .
      dockerfile: apps/user-service/Dockerfile
    environment:
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - DB_NAME=${MYSQL_DATABASE}
    depends_on:
      - mysql
    restart: unless-stopped

  order-service:
    build:
      context: .
      dockerfile: apps/order-service/Dockerfile
    environment:
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - DB_NAME=${MYSQL_DATABASE}
    depends_on:
      - mysql
    restart: unless-stopped

  nextjs:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  mysql_data:
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml for deployment"
```

---

## Task 2: 创建 NestJS 各服务的 Dockerfile

**Files:**
- Create: `apps/gateway/Dockerfile`
- Create: `apps/user-service/Dockerfile`
- Create: `apps/order-service/Dockerfile`

- [ ] **Step 1: 创建 apps/gateway/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gateway ./apps/gateway
COPY libs ./libs

RUN npm install -g pnpm && pnpm install && pnpm build --filter= gateway

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3010

CMD ["node", "dist/apps/gateway/main.js"]
```

- [ ] **Step 2: 创建 apps/user-service/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/user-service ./apps/user-service
COPY libs ./libs

RUN npm install -g pnpm && pnpm install && pnpm build --filter= user-service

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/apps/user-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/apps/user-service/main.js"]
```

- [ ] **Step 3: 创建 apps/order-service/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/order-service ./apps/order-service
COPY libs ./libs

RUN npm install -g pnpm && pnpm install && pnpm build --filter= order-service

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/apps/order-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3002

CMD ["node", "dist/apps/order-service/main.js"]
```

- [ ] **Step 4: Commit**

```bash
git add apps/gateway/Dockerfile apps/user-service/Dockerfile apps/order-service/Dockerfile
git commit -m "feat: add Dockerfiles for all NestJS services"
```

---

## Task 3: 创建 Next.js 前端项目

**Files:**
- Create: `frontend/` (新建 Next.js 项目)
- Create: `frontend/Dockerfile`
- Create: `frontend/next.config.js`

- [ ] **Step 1: 创建 frontend/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["npm", "start"]
```

- [ ] **Step 2: 创建 frontend/next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

- [ ] **Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: add Next.js frontend project"
```

---

## Task 4: 创建 Nginx 配置文件

**Files:**
- Create: `nginx/conf.d/api.chenchar.com.conf`
- Create: `nginx/conf.d/admin.chenchar.com.conf`
- Create: `nginx/ssl/.gitkeep` (占位目录)

- [ ] **Step 1: 创建 nginx/conf.d/api.chenchar.com.conf**

```nginx
server {
    listen 80;
    server_name api.chenchar.com;

    location / {
        proxy_pass http://gateway:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 2: 创建 nginx/conf.d/admin.chenchar.com.conf**

```nginx
server {
    listen 80;
    server_name admin.chenchar.com;

    location / {
        proxy_pass http://nextjs:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

- [ ] **Step 3: 创建 nginx/ssl/.gitkeep**

```
# This directory will contain SSL certificates from Let's Encrypt
```

- [ ] **Step 4: Commit**

```bash
git add nginx/conf.d/api.chenchar.com.conf nginx/conf.d/admin.chenchar.com.conf nginx/ssl/.gitkeep
git commit -m "feat: add nginx configuration files"
```

---

## Task 5: 创建环境变量文件

**Files:**
- Create: `.env`
- Create: `.env.example`

- [ ] **Step 1: 创建 .env.example**

```env
# MySQL
MYSQL_ROOT_PASSWORD=your_secure_password
MYSQL_DATABASE=app_database

# JWT
JWT_SECRET=your_jwt_secret_key_change_in_production
```

- [ ] **Step 2: 创建 .env (根据实际值)**

```env
MYSQL_ROOT_PASSWORD=change_me
MYSQL_DATABASE=app_database
JWT_SECRET=change_me
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "feat: add environment variables template"
```

---

## Task 6: 编写部署文档

**Files:**
- Create: `docs/deployment-guide.md`

- [ ] **Step 1: 创建部署指南**

```markdown
# 部署指南

## 服务器环境准备

### 1. 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 2. 安装 Docker Compose

```bash
sudo apt update
sudo apt install docker-compose
```

### 3. 配置防火墙

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
```

## DNS 配置

在腾讯云域名控制台添加以下 A 记录：

| 主机记录 | 记录类型 | IP 地址 |
|---------|---------|---------|
| admin | A | 服务器公网 IP |
| api | A | 服务器公网 IP |

## SSL 证书配置

### 安装 certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

### 申请证书

```bash
# 先启动 nginx (临时)
docker-compose up -d nginx

# 申请证书
sudo certbot --nginx -d api.chenchar.com -d admin.chenchar.com

# 证书将保存到 /etc/letsencrypt/live/
```

### 复制证书到容器

```bash
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/api.chenchar.com/* nginx/ssl/api.chenchar.com/
sudo cp /etc/letsencrypt/live/admin.chenchar.com/* nginx/ssl/admin.chenchar.com/
```

## 部署步骤

### 1. 克隆代码到服务器

```bash
git clone <repo-url> /app
cd /app
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env  # 填写实际值
```

### 3. 构建并启动所有服务

```bash
docker-compose build
docker-compose up -d
```

### 4. 查看服务状态

```bash
docker-compose ps
docker-compose logs -f
```

## 验证部署

- 访问 https://admin.chenchar.com - 应看到前端页面
- 访问 https://api.chenchar.com - 应返回网关响应

## 常见问题

### 容器无法启动

```bash
docker-compose logs <service-name>
```

### 数据库连接失败

检查 MySQL 容器是否正常运行：
```bash
docker-compose exec mysql mysql -u root -p
```

### Nginx 502 错误

检查后端服务是否正常启动：
```bash
docker-compose ps
curl http://localhost:3010  # 本地测试网关
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/deployment-guide.md
git commit -m "docs: add deployment guide"
```

---

## 执行顺序

1. Task 1: docker-compose.yml
2. Task 2: NestJS Dockerfiles
3. Task 3: Next.js 前端
4. Task 4: Nginx 配置
5. Task 5: 环境变量
6. Task 6: 部署文档

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-deployment-plan.md`**.

两个执行选项：

**1. Subagent-Driven (推荐)** - 每个任务派遣独立 subagent，快速迭代

**2. Inline Execution** - 当前 session 内顺序执行，带检查点

选择哪个？