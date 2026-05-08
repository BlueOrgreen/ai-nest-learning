# Nginx 学习笔记

日期：2026-05-01

## 1. Nginx 是什么？

Nginx 是一款高性能的 Web 服务器，主要用于：
- 静态文件服务
- **反向代理**
- 负载均衡
- SSL termination

### 为什么使用 Nginx？

```
用户请求 → Nginx → 真实服务器
           ↑
      充当"门卫"角色
```

你的场景：用户访问 `api.chenchar.com` → Nginx → Gateway 容器

---

## 2. 反向代理原理

### 正向代理 vs 反向代理

| 类型 | 用途 | 客户端知道吗 |
|------|------|-------------|
| 正向代理 | 帮客户端访问无法直接访问的资源（如翻墙） | 客户端需要配置 |
| 反向代理 | 帮服务端隐藏真实架构，分发请求 | 客户端无感知 |

### 你的场景图解

```
浏览器输入: https://api.chenchar.com
                    ↓
            DNS 解析 → 你的服务器公网 IP
                    ↓
               Nginx (80端口)
                    ↓
         server_name 检查匹配到 api.chenchar.com
                    ↓
            location / { proxy_pass }
                    ↓
              转发到 gateway:3010
                    ↓
               返回响应
```

---

## 3. Nginx 配置文件结构

### 最小配置示例

```nginx
# 全局配置
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    # HTTP 服务器块
    server {
        listen 80;
        server_name example.com;

        location / {
            root /var/www/html;
        }
    }
}
```

### 你的实际配置文件

**文件 1：api.chenchar.com.conf**
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

**文件 2：admin.chenchar.com.conf**
```nginx
server {
    listen 80;
    server_name admin.chenchar.com;

    location / {
        proxy_pass http://web-nest:3000;
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

---

## 4. 核心概念解析

### 4.1 server { } 块 - 服务器块

每个 `server { }` 块定义一个"网站"。

```nginx
server {
    listen 80;                              # 监听端口
    server_name api.chenchar.com;            # 匹配域名
    # ... 其他配置 ...
}
```

**工作流程：**
1. 请求到达 80 端口
2. Nginx 检查 `server_name` 是否匹配
3. 匹配成功则使用该 server 块处理请求

**你的场景：**
- 请求 `api.chenchar.com:80` → 匹配第一个 server 块
- 请求 `admin.chenchar.com:80` → 匹配第二个 server 块

### 4.2 location { } 块 - 路径匹配

```nginx
location / {
    # 匹配所有路径
}

location /api {
    # 匹配以 /api 开头的路径
}

location ~ \.php$ {
    # 正则匹配 .php 结尾的路径
}
```

**匹配优先级（从高到低）：**
1. 精确匹配 `location = /path`
2. 前缀匹配 `location ^~ /path`
3. 正则匹配 `location ~ /path`
4. 普通前缀匹配 `location /path`

### 4.3 proxy_pass - 反向代理指令

```nginx
location / {
    proxy_pass http://gateway:3010;  # 转发到该地址
}
```

**URL 变化规则：**
- `proxy_pass http://example.com` → 保持原 URL
- `proxy_pass http://example.com/` → 替换 location 部分

**你的场景：**
```
用户访问: http://api.chenchar.com/users/123
                      ↓
location / 匹配
                      ↓
proxy_pass http://gateway:3010
                      ↓
实际请求: http://gateway:3010/users/123
```

### 4.4 proxy_set_header - 传递请求头

为什么需要传递？ 因为直接访问网关时，HTTP 头信息是 Nginx 的，不是真实用户的。

| 指令 | 作用 | 值 |
|------|------|-----|
| `Host` | 告诉后端原始域名 | `$host`（Nginx 收到的 Host） |
| `X-Real-IP` | 传递客户端真实 IP | `$remote_addr` |
| `X-Forwarded-For` | 传递代理链 IP | `$proxy_add_x_forwarded_for` |
| `X-Forwarded-Proto` | 传递原始协议 | `$scheme`（http/https） |

**X-Forwarded-For 示例：**
```
客户端 IP: 1.2.3.4
    ↓ 通过代理 A
代理 A 添加: X-Forwarded-For: 1.2.3.4
    ↓ 通过代理 B
代理 B 变成: X-Forwarded-For: 1.2.3.4, 5.6.7.8
```

### 4.5 WebSocket 支持

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

这是什么？ WebSocket 是一种保持长连接的通信协议，与普通 HTTP 请求不同。

为什么需要？ Next.js 开发模式的热更新（HMR）使用 WebSocket。

**普通 HTTP vs WebSocket：**
```
HTTP: 请求 → 响应 → 断开
WebSocket: 建立连接 → 双向通信 → 保持连接
```

---

## 5. 结合 docker-compose 的服务发现

### Docker 网络内如何找到其他容器？

```nginx
# docker-compose.yml 中定义的服务名
proxy_pass http://gateway:3010;   # gateway 是容器名
proxy_pass http://web-nest:3000;  # web-nest 是容器名
```

Docker 内置 DNS 会自动解析：
```
gateway → gateway 容器的 IP
web-nest → web-nest 容器的 IP
```

**不需要知道容器 IP，Docker 自动维护服务名到 IP 的映射。**

---

## 6. SSL/HTTPS 配置（后续步骤）

当前配置只有 80 端口，添加 SSL 后的配置：

```nginx
server {
    listen 443 ssl;
    server_name api.chenchar.com;

    ssl_certificate /etc/nginx/ssl/api.chenchar.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/api.chenchar.com/privkey.pem;

    location / {
        proxy_pass http://gateway:3010;
        # ... 其他 proxy_set_header ...
    }
}
```

**证书从哪里来？**
- Let's Encrypt 免费证书（通过 certbot 自动申请）
- 申请后保存到 `nginx/ssl/` 目录
- 通过 volume 挂载到 Nginx 容器内

---

## 7. 常用命令

```bash
# 测试配置文件语法
nginx -t

# 重新加载配置（不重启）
nginx -s reload

# 查看 nginx 进程
ps aux | grep nginx

# 查看端口占用
netstat -tlnp | grep 80
```

---

## 8. 排查问题

### 502 Bad Gateway

原因：proxy_pass 指向的后端服务无法访问

排查步骤：
```bash
# 1. 检查后端容器是否运行
docker-compose ps

# 2. 检查容器网络连通性
docker-compose exec nginx ping gateway

# 3. 直接测试后端是否响应
curl http://gateway:3010
```

### 504 Gateway Timeout

原因：后端服务响应太慢

解决：
```nginx
proxy_connect_timeout 60s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;
```

---

## 9. 总结

你的部署架构中，Nginx 核心作用：

| 职责 | 说明 |
|------|------|
| 域名分发 | 根据 server_name 将请求路由到不同服务 |
| 反向代理 | 隐藏后端容器，接收外部请求 |
| 协议转换 | HTTP → HTTPS（后续） |
| 头部传递 | 保持客户端原始信息 |
| WebSocket | 支持 Next.js 热更新 |      