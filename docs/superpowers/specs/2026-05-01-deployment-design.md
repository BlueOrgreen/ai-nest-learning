# 部署设计方案

日期：2026-05-01

## 目标

将项目部署到腾讯云轻量应用服务器，通过子域名 + Nginx 反向代理 + Docker 容器管理多个应用。

## 整体架构

```
Internet
    │
    ├─ admin.chenchar.com ──→ Nginx (SSL) ──→ Next.js 容器 (3000)
    │
    └─ api.chenchar.com ──→ Nginx (SSL) ──→ Gateway 容器 (:3010)
                                      │
                          ┌───────────┼───────────┐
                          ↓                       ↓
                    user-service              order-service
                    (3001)                    (3002)
                          │                       │
                          └───────────┬───────────┘
                                      ↓
                                 MySQL (:3306)
```

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| Web 服务器 | Nginx | 反向代理 + SSL |
| 容器管理 | Docker + Docker Compose | 管理所有容器 |
| 后端框架 | NestJS | gateway, user-service, order-service |
| 前端框架 | Next.js | admin.chenchar.com |
| 数据库 | MySQL | 通过 Docker 部署 |
| SSL 证书 | Let's Encrypt (certbot) | 免费自动续期 |

## 域名配置

在腾讯云域名控制台添加 DNS A 记录：

| 域名 | 指向 |
|------|------|
| admin.chenchar.com | 服务器公网 IP |
| api.chenchar.com | 服务器公网 IP |

## Docker Compose 服务

```yaml
services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - gateway
      - nextjs

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  gateway:
    build: ./apps/gateway
    ports:
      - "3010:3010"
    depends_on:
      - mysql

  user-service:
    build: ./apps/user-service
    ports:
      - "3001:3001"
    depends_on:
      - mysql

  order-service:
    build: ./apps/order-service
    ports:
      - "3002:3002"
    depends_on:
      - mysql

  nextjs:
    build: ./frontend
    ports:
      - "3000:3000"
```

## Nginx 配置

### 网关代理配置 (api.chenchar.com)

```nginx
server {
    listen 80;
    server_name api.chenchar.com;

    ssl_certificate /etc/nginx/ssl/live/api.chenchar.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/api.chenchar.com/privkey.pem;

    location / {
        proxy_pass http://gateway:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 前端代理配置 (admin.chenchar.com)

```nginx
server {
    listen 80;
    server_name admin.chenchar.com;

    ssl_certificate /etc/nginx/ssl/live/admin.chenchar.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/admin.chenchar.com/privkey.pem;

    location / {
        proxy_pass http://nextjs:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 部署步骤

1. **服务器环境准备**
   - 安装 Docker
   - 安装 Docker Compose
   - 配置防火墙（开放 80/443 端口）

2. **域名 DNS 配置**
   - 在腾讯云添加 admin.chenchar.com A 记录
   - 在腾讯云添加 api.chenchar.com A 记录

3. **配置 SSL 证书**
   - 安装 certbot
   - 为两个域名申请 Let's Encrypt 证书

4. **启动数据库**
   - 配置 MySQL 容器
   - 初始化数据库和用户

5. **构建并启动后端服务**
   - 构建 gateway、user-service、order-service 镜像
   - 启动各微服务容器

6. **构建并启动前端**
   - 构建 Next.js 镜像
   - 启动前端容器

7. **配置 Nginx**
   - 配置反向代理规则
   - 应用 SSL 证书

## 环境变量

需要配置以下环境变量：

```env
# 数据库
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_DATABASE=app_database

# 后端服务
DATABASE_HOST=mysql
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
```

## 服务端口映射

| 服务 | 容器内部端口 | 外部访问端口（通过 Nginx） |
|------|-------------|--------------------------|
| Nginx | 80, 443 | 80, 443 |
| MySQL | 3306 | 仅内部容器访问 |
| Gateway | 3010 | 通过 api.chenchar.com |
| user-service | 3001 | 仅内部容器访问 |
| order-service | 3002 | 仅内部容器访问 |
| Next.js | 3000 | 通过 admin.chenchar.com |