# 后端 Dockerfile（多阶段：支持 production / development 两种 target）
# - 生产：docker-compose.yml 使用 target=production，直接 node 启动，稳定低开销
# - 开发：docker-compose.override.yml 使用 target=development，nodemon 热更新
FROM node:18-alpine AS base

WORKDIR /app

# 先装依赖（含 devDependencies，供 development target 使用 nodemon）
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

EXPOSE 3001


# ---------- 生产阶段 ----------
FROM base AS production
ENV NODE_ENV=production
CMD ["node", "src/index.js"]


# ---------- 开发阶段（热更新） ----------
FROM base AS development
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]
