# 新业务接入指南 —— 同一台服务器、二级域名路由、Docker 内网部署

本文档面向**已有总反向代理（本目录）和至少一个业务（如 MealLog）已正常运行**的场景。
以后每新增一个"前端 + 后端 + MySQL"的 Docker 项目，按本指南操作即可接入同一台服务器，用二级域名区分。

---

## 一、服务器前置条件（一次性配置，每个新项目不需要重复做）

以下操作在服务器首次搭建时已完成，新项目接入前确认即可：

| 项目 | 状态 | 说明 |
|---|---|---|
| Docker + docker-compose 已安装 | ✅ | 见各业务项目的 deploy.sh |
| 共享网络 `meal-log-network` 已创建 | ✅ | 第一个业务启动时自动创建，或手动 `docker network create meal-log-network` |
| 总反向代理 `reverse-proxy` 已启动 | ✅ | 独占宿主机 80/443，SSL 终止、http→https 跳转、按 Host 分流 |
| Cloudflare 泛域名证书 `*.meallog.eu.cc` 已上传到 `reverse-proxy/cert/` | ✅ | Origin 证书，必须保持 DNS 橙色云朵开启 |
| Oracle 云安全组 + 服务器 ufw 已放行 80/443 | ✅ | 业务端口（如 3000/3001）**不对外** |

---

## 二、新项目目录结构模板

假设新项目叫 `app2`，在服务器上创建独立目录（**不要放在现有业务目录内，也不要放在 reverse-proxy 内**）：

```
/home/ubuntu/
├── reverse-proxy/          ← 独立总代理（管理所有应用）
│   ├── docker-compose.yml
│   ├── conf/
│   └── cert/
├── meallog/                ← MealLog 业务项目
├── app2/                   ← 新项目（独立目录）
│   ├── backend/
│   │   ├── src/
│   │   │   └── index.js
│   │   ├── .env
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── frontend/
│   │   ├── src/
│   │   ├── public/
│   │   ├── build/              # 本地构建产物，随 deploy 分支提交
│   │   ├── nginx.conf          # 业务侧纯 HTTP nginx 配置
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── docker-compose.yml
│   ├── docker-compose.override.yml   # 本地热更新层（可选）
│   ├── .env
│   ├── .env.example
│   └── deploy.sh               # 一键部署脚本（可选）
└── app3/                   ← 未来第三个业务项目
```

> **重要**：每个业务项目都是独立目录，互不干扰。reverse-proxy 也是独立目录，不在任何业务项目内。

---

## 三、新项目 docker-compose.yml 模板

**核心原则：**
- 所有服务加入 `meal-log-network`（external: true）
- **不映射任何宿主机端口**（对外由总反向代理按二级域名转发）
- 不写 `container_name`（避免多实例冲突）
- 业务容器间通过**服务名**互相访问（compose 网络内置 DNS）

```yaml
# =============================================================================
# app2 项目 docker-compose.yml
# 接入总反向代理架构：本文件不映射任何宿主机端口，对外访问由 reverse-proxy 按二级域名转发
# =============================================================================

services:
  # MySQL 数据库
  mysql:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-app2_password}
      MYSQL_DATABASE: app2_db
      MYSQL_USER: ${DB_USER:-app2user}
      MYSQL_PASSWORD: ${DB_PASSWORD:-app2_password}
    # 不映射 3306 到宿主机：backend 通过服务名 mysql 内网访问
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - meal-log-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 后端服务
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DB_HOST: mysql          # 通过服务名访问
      DB_PORT: 3306
      DB_USER: ${DB_USER:-app2user}
      DB_PASSWORD: ${DB_PASSWORD:-app2_password}
      DB_NAME: app2_db
      JWT_SECRET: ${JWT_SECRET:-your_jwt_secret_key}
    # 不映射宿主机端口：仅 frontend 经内网代理访问 backend:3001
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - meal-log-network

  # 前端服务
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: production
    restart: unless-stopped
    # 不映射宿主机端口：对外由总反向代理按二级域名转发进来
    depends_on:
      - backend
    networks:
      - meal-log-network

volumes:
  mysql_data:
    driver: local

networks:
  # 共享网络：由第一个业务（MealLog）创建，这里以外部网络方式接入
  meal-log-network:
    external: true
```

---

## 四、新项目 nginx.conf 模板（frontend/nginx.conf）

**核心原则：**
- 只监听 80，**绝不写 SSL/443**（SSL 在总代理终止）
- `server_name _` 泛匹配（总代理转发过来的请求 Host 是二级域名，业务 nginx 不感知）
- 缓存策略：index.html 禁缓存，/static/ 长缓存（带哈希的静态资源）
- `/api` 反代到后端服务名

```nginx
server {
    listen 80;
    # 泛匹配任意 Host：请求由外层总反向代理按二级域名转发进来，
    # 业务 nginx 只处理纯 HTTP，不感知具体域名
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # 缓存策略：index.html 禁缓存（防止发新版后浏览器用旧入口）
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # 带哈希的静态资源长缓存（文件名变了哈希就变，天然不会读到旧版本）
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 其余路径兜底不缓存
    location / {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端（通过服务名内网访问）
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 健康检查
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

---

## 五、新项目 Dockerfile 模板

### 前端 Dockerfile（多阶段：production / development）

```dockerfile
# ---------- 依赖安装层（development target 使用） ----------
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# ---------- 生产阶段：nginx 托管打包产物（纯静态，服务器零构建） ----------
FROM nginx:alpine AS production
COPY build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ---------- 开发阶段：React 开发服务器（热更新） ----------
FROM deps AS development
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "start"]
```

### 后端 Dockerfile（多阶段：production / development）

```dockerfile
# ---------- 依赖安装层（development target 使用） ----------
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# ---------- 生产阶段：node 直启 ----------
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 3001
CMD ["node", "src/index.js"]

# ---------- 开发阶段：nodemon 热更新 ----------
FROM deps AS development
COPY . .
ENV NODE_ENV=development
EXPOSE 3001
CMD ["npx", "nodemon", "src/index.js"]
```

---

## 六、服务器部署步骤（新项目）

假设新项目叫 `app2`，二级域名 `app2.meallog.eu.cc`：

### 1. 本地构建前端产物（在 Mac 上）

```bash
cd app2/frontend
env -u REACT_APP_API_URL npm run build
# 验证 bundle 不含 localhost
grep -rl "localhost:3001" build/static/js/ && echo "❌ 仍含 localhost" || echo "✅ 干净"
```

### 2. 提交并推送到服务器（通过 git 或 scp）

```bash
# 方式 A：git 推送
git add -A
git commit -m "feat: app2 初始版本"
git push

# 方式 B：scp 上传（适合无 git 的场景）
scp -r app2/ ubuntu@服务器IP:/home/ubuntu/app2/
```

### 3. 服务器上启动新项目

```bash
ssh ubuntu@服务器IP
cd /home/ubuntu/app2

# 复制环境变量模板并修改
cp .env.example .env
vim .env   # 修改数据库密码、JWT 密钥等

# 启动（自动加入共享网络 meal-log-network）
docker-compose -f docker-compose.yml up -d --build

# 验证容器运行
docker-compose ps
docker network inspect meal-log-network   # 应看到 app2 的 3 个容器
```

> **注意**：如果报 `network meal-log-network not found`，说明 MealLog 还没启动过。先启动 MealLog（会自动创建网络），或手动执行 `docker network create meal-log-network`。

### 4. 在总反向代理中添加新站点的 nginx 配置

```bash
# 注意：reverse-proxy 是独立目录，不在任何业务项目内
cd /home/ubuntu/reverse-proxy

# 复制 MealLog 的配置作为模板
cp conf/10-meal-log.conf conf/20-app2.conf

# 修改 3 处（用 vim 或 sed）：
#   1. server_name app2.meallog.eu.cc
#   2. proxy_pass http://app2-frontend:80  ← 注意：这里要写 app2 项目的服务名
#      如果 app2 的 docker-compose.yml 里服务名也叫 frontend，则写 http://frontend:80
#      但多个项目的服务名都是 frontend 会 DNS 冲突！
#      ⚠️ 解决方案见下方“服务名冲突处理”
#   3. 注释里的项目名（可选）
# 证书文件名无需改（泛域名证书 *.meallog.eu.cc 自动覆盖所有二级域名）
```

### 5. 重启总反向代理

```bash
cd /home/ubuntu/reverse-proxy
docker-compose restart
# 或 docker-compose reload（nginx 支持热加载配置）
```

### 6. Cloudflare DNS 添加 A 记录

- 类型：A
- 名称：`app2`（即 `app2.meallog.eu.cc`）
- 内容：服务器公网 IP
- **代理状态：橙色云朵（已代理）** ← 必须！灰色会证书报错

### 7. 验证

```bash
# 服务器上执行
curl -Ik http://app2.meallog.eu.cc        # 应返回 301 跳到 https
curl -Ik https://app2.meallog.eu.cc       # 应返回 200

# 浏览器无痕模式打开 https://app2.meallog.eu.cc
```

---

## 七、服务名冲突处理（重要）

### 问题
多个项目都加入同一个 `meal-log-network`，如果服务名都叫 `frontend`，DNS 会解析到多个容器（round-robin），总代理无法准确路由。

### 解决方案

**方案 A（推荐）：每个项目的服务名加项目前缀**

```yaml
# app2/docker-compose.yml
services:
  app2-frontend:    # 服务名加前缀
    ...
  app2-backend:
    ...
  app2-mysql:
    ...
```

总代理配置：
```nginx
proxy_pass http://app2-frontend:80;
```

**方案 B：每个项目用独立的网络**

```yaml
# app2/docker-compose.yml
networks:
  app2-network:
    name: app2-network    # 独立网络
```

总代理加入两个网络：
```yaml
# reverse-proxy/docker-compose.yml
networks:
  meal-log-network:
    external: true
  app2-network:
    external: true
```

总代理配置：
```nginx
proxy_pass http://frontend:80;   # 在 app2-network 中，服务名 frontend 唯一
```

**推荐方案 A**：简单直观，所有服务在同一个网络，总代理只需加一个网络。

---

## 八、验证清单

每新增一个项目，逐项确认：

- [ ] 本地 `npm run build` 产物不含 `localhost`
- [ ] 服务器 `docker-compose ps` 显示 3 个容器运行中
- [ ] `docker network inspect meal-log-network` 看到新项目的容器
- [ ] 新项目的容器**没有**映射宿主机端口（`docker ps` 的 PORTS 列为空）
- [ ] `reverse-proxy/conf/` 有新站点的 `.conf` 文件
- [ ] `reverse-proxy/cert/` 有泛域名证书（如果是泛域名，无需新增）
- [ ] Cloudflare DNS 有新二级域名的 A 记录，橙色云朵开启
- [ ] `curl -Ik http://新域名` 返回 301
- [ ] `curl -Ik https://新域名` 返回 200
- [ ] 浏览器无痕模式打开 `https://新域名` 能正常注册/登录

---

## 九、常见问题

### Q1：新项目启动失败，报 `network meal-log-network not found`
**原因**：第一个业务（MealLog）还没启动过，网络没创建。  
**解决**：`docker network create meal-log-network`，然后重新启动新项目。

### Q2：总代理重启失败，报 `network meal-log-network not found`
**原因**：同上，网络不存在。  
**解决**：先启动任意一个业务（会自动创建网络），或手动创建网络。

### Q3：访问新域名返回 502 Bad Gateway
**可能原因**：
1. 总代理配置里的 `proxy_pass` 服务名写错（检查是否和 docker-compose.yml 里的服务名一致）
2. 新项目的 frontend 容器没启动（`docker-compose ps` 检查）
3. 新项目没加入 `meal-log-network`（`docker network inspect` 检查）

### Q4：访问新域名返回 444（连接被重置）
**原因**：请求的 Host 没匹配任何 server 块，落到 90-default-ssl.conf 被丢弃。  
**解决**：检查 `reverse-proxy/conf/` 里有没有新站点的 `.conf` 文件，`server_name` 是否写对。

### Q5：浏览器报证书不信任
**原因**：Cloudflare DNS 记录是灰色云朵（直连），Origin 证书不被公共 CA 信任。  
**解决**：Cloudflare 控制台把 DNS 记录改为橙色云朵（已代理）。

### Q6：新项目前端请求 API 报 CORS 或 localhost
**原因**：前端 bundle 里烘焙了 `http://localhost:3001`。  
**解决**：
1. 检查源码里 `API_URL` 的 fallback 是否为 `''`（相对路径）
2. 本地重新 `npm run build`
3. 验证 `grep -rl "localhost:3001" build/static/js/` 无结果
4. 重新提交 build/ 并推送

### Q7：新项目数据库连不上
**可能原因**：
1. backend 的 `DB_HOST` 写成了 `localhost`（应为服务名 `mysql` 或 `app2-mysql`）
2. MySQL 容器没通过健康检查（`docker-compose logs mysql` 查看）
3. backend 的 `depends_on` 没写 `condition: service_healthy`

---

## 十、快速复制命令（一键生成新项目骨架）

```bash
# 在服务器上执行，假设新项目叫 app2
cd /home/ubuntu
mkdir -p app2/{backend/src,frontend/{src,public,build}}
cd app2

# 复制 MealLog 的配置作为起点（按需修改）
# 或直接参考本文档第三~五节的模板手动创建

# 后续步骤见第六节
```

---

## 附录：命名规范

| 类型 | 规范 | 示例 |
|---|---|---|
| 项目目录名 | 小写，无空格 | `app2`、`my-blog` |
| docker-compose 服务名 | 建议加项目前缀 | `app2-frontend`、`app2-backend`、`app2-mysql` |
| 二级域名 | 项目名.主域名 | `app2.meallog.eu.cc` |
| 数据库名 | 项目名_db | `app2_db` |
| 数据库用户 | 项目名user | `app2user` |
| 环境变量文件 | `.env`（不提交 git） | 从 `.env.example` 复制 |
| JWT 密钥 | 随机长字符串 | `openssl rand -base64 32` |

---

## 总结：新项目接入 7 步

1. **本地构建前端**（验证无 localhost）
2. **提交推送到服务器**（git 或 scp）
3. **服务器启动新项目**（`docker-compose up -d --build`）
4. **总代理添加站点配置**（复制 conf 模板，改 server_name + proxy_pass）
5. **重启总代理**（`docker-compose restart`）
6. **Cloudflare 添加 DNS A 记录**（橙色云朵）
7. **验证**（curl + 浏览器）

以后每新增一个项目，重复这 7 步即可，总代理和共享网络无需重建。
