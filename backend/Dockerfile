# 后端 Dockerfile（多阶段：支持 production / development 两种 target）
# - 生产：target=production，只安装生产依赖（--omit=dev），node 直启，低内存友好
# - 开发：target=development，完整依赖 + nodemon 热更新

# ---------- 生产阶段 ----------
FROM node:18-alpine AS production

WORKDIR /app

# 只装生产依赖：6 个纯 JS 包，无编译，低内存服务器可安全执行
COPY package*.json ./
RUN npm install --omit=dev

# 复制源代码
COPY src ./src

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "src/index.js"]


# ---------- 开发阶段（热更新） ----------
FROM node:18-alpine AS development

WORKDIR /app

# 装全部依赖（含 devDependencies 的 nodemon）
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]
