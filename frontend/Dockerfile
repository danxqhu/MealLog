# 前端 Dockerfile（多阶段：支持 production / development 两种 target）
# - 生产：target=production，nginx 直接托管本地已打包好的 build/ 静态资源。
#   服务器上不再执行 npm run build（避免低内存机器构建卡死），
#   build/ 由本地 release.sh 构建并随 deploy 分支发布。
# - 开发：target=development，React 开发服务器热更新

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
