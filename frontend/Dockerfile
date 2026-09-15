# 前端 Dockerfile（多阶段：支持 production / development 两种 target）
# - 生产：docker-compose.yml 使用 target=production，nginx 提供打包后的静态资源
# - 开发：docker-compose.override.yml 使用 target=development，React 开发服务器热更新

# ---------- 依赖安装层（两种 target 共用） ----------
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install


# ---------- 构建层（生产 target 使用） ----------
FROM deps AS builder
COPY . .
RUN npm run build


# ---------- 生产阶段：nginx 托管 build 产物 ----------
FROM nginx:alpine AS production
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


# ---------- 开发阶段：React 开发服务器（热更新） ----------
FROM deps AS development
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "start"]
