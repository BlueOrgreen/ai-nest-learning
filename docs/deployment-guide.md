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

**双库配置（与本地一致）**：`.env` 中必须包含：

```env
USER_DB_DATABASE=nest_user_service
ORDER_DB_DATABASE=nest_order_service
```

`user-service` / `order-service` 会分别连接上述库，勿再共用 `MYSQL_DATABASE=nest_db`。

**已有 MySQL 数据卷时导入本地数据**（`mysql/init/dumps/*.sql` 仅在首次空卷初始化时自动执行）：

```bash
export MYSQL_ROOT_PASSWORD=你的密码
MYSQL_C=my-firstnest-mysql-1   # docker compose ps 中的 mysql 容器名

docker exec -i $MYSQL_C mysql -uroot -p"$MYSQL_ROOT_PASSWORD" nest_user_service \
  < mysql/init/dumps/nest_user_service.sql
docker exec -i $MYSQL_C mysql -uroot -p"$MYSQL_ROOT_PASSWORD" nest_order_service \
  < mysql/init/dumps/nest_order_service.sql
```

更新代码后务必重建服务使库名生效：

```bash
docker compose up -d --build user-service order-service gateway
docker compose exec user-service printenv | grep DB_DATABASE   # 应为 nest_user_service
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