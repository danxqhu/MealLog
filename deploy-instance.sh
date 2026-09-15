#!/bin/bash

# ============================================
# MealLog 多实例部署脚本
# 同一台服务器上运行多个互不干扰的 MealLog 实例
#
# 使用方法:
#   1. 为每个实例复制一份环境变量文件（例如 .env.meal1、.env.meal2），
#      每个实例必须使用不同的 FRONTEND_PORT / BACKEND_PORT / 数据库密码 / JWT_SECRET
#   2. chmod +x deploy-instance.sh
#   3. ./deploy-instance.sh <实例名> <环境变量文件>
#
# 示例:
#   ./deploy-instance.sh meal1 .env.meal1
#   ./deploy-instance.sh meal2 .env.meal2
#
# 实例名会成为 compose 项目名，容器/网络/数据卷都自动带前缀隔离：
#   容器: meal1-mysql、meal1-backend、meal1-frontend
#   数据卷: meal1_mysql_data（每个实例一套独立数据库）
# ============================================

set -e

INSTANCE_NAME=$1
ENV_FILE=$2

# ---------- 参数校验 ----------
if [ -z "$INSTANCE_NAME" ] || [ -z "$ENV_FILE" ]; then
    echo "用法: $0 <实例名> <环境变量文件>"
    echo "示例: $0 meal1 .env.meal1"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "错误: 环境变量文件 $ENV_FILE 不存在"
    exit 1
fi

echo "=========================================="
echo "  MealLog 多实例部署"
echo "  实例名: $INSTANCE_NAME"
echo "  环境文件: $ENV_FILE"
echo "=========================================="
echo ""

# ---------- 1. 环境检查 ----------
echo "[1/4] 检查 Docker 环境..."

if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装，请先安装 Docker"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "错误: docker-compose 未安装"
    exit 1
fi

echo "  Docker: $(docker --version)"
echo "  Compose: $($COMPOSE_CMD version)"
echo ""

# ---------- 2. 环境变量校验 ----------
echo "[2/4] 校验环境变量..."

if grep -qE "your_strong_|your_random_" "$ENV_FILE" 2>/dev/null; then
    echo "  ❌ 错误: $ENV_FILE 中仍包含示例密码/密钥，请先修改！"
    exit 1
fi

# 从环境文件读取端口（供最后提示用），默认值与 docker-compose.yml 一致
FRONTEND_PORT=$(grep -E '^FRONTEND_PORT=' "$ENV_FILE" | cut -d= -f2)
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_PORT=$(grep -E '^BACKEND_PORT=' "$ENV_FILE" | cut -d= -f2)
BACKEND_PORT=${BACKEND_PORT:-3001}

# 检查端口是否已被其他实例占用（本实例自己的容器除外）
if docker ps --format '{{.Names}} {{.Ports}}' | grep -E "0.0.0.0:${FRONTEND_PORT}->|:::${FRONTEND_PORT}->" | grep -v "^${INSTANCE_NAME}-" &> /dev/null; then
    echo "  ❌ 错误: 宿主机端口 ${FRONTEND_PORT} 已被其他容器占用，请更换 FRONTEND_PORT"
    exit 1
fi
if docker ps --format '{{.Names}} {{.Ports}}' | grep -E "0.0.0.0:${BACKEND_PORT}->|:::${BACKEND_PORT}->" | grep -v "^${INSTANCE_NAME}-" &> /dev/null; then
    echo "  ❌ 错误: 宿主机端口 ${BACKEND_PORT} 已被其他容器占用，请更换 BACKEND_PORT"
    exit 1
fi

echo "  前端端口: ${FRONTEND_PORT}"
echo "  后端端口: ${BACKEND_PORT}"
echo ""

# ---------- 3. 构建并启动 ----------
echo "[3/4] 构建并启动实例 ${INSTANCE_NAME}（生产模式）..."

# 显式 -f docker-compose.yml 跳过 override，保证生产模式
$COMPOSE_CMD -p "$INSTANCE_NAME" --env-file "$ENV_FILE" -f docker-compose.yml up -d --build
echo ""

# ---------- 4. 验证 ----------
echo "[4/4] 等待服务就绪..."
sleep 10

SERVER_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
echo "  实例 ${INSTANCE_NAME} 部署完成!"
echo "=========================================="
echo ""
echo "  容器状态:"
$COMPOSE_CMD -p "$INSTANCE_NAME" ps
echo ""
echo "  访问地址:"
echo "    应用入口:  http://${SERVER_IP}:${FRONTEND_PORT}"
echo "    后端 API:  http://${SERVER_IP}:${BACKEND_PORT}（已可由 nginx 反代，通常无需直接访问）"
echo ""
echo "  本实例管理命令（注意 -p ${INSTANCE_NAME} 指定实例）:"
echo "    查看日志:    $COMPOSE_CMD -p $INSTANCE_NAME -f docker-compose.yml logs -f"
echo "    重启服务:    $COMPOSE_CMD -p $INSTANCE_NAME -f docker-compose.yml restart"
echo "    停止并删除:  $COMPOSE_CMD -p $INSTANCE_NAME -f docker-compose.yml down"
echo "    删除含数据:  $COMPOSE_CMD -p $INSTANCE_NAME -f docker-compose.yml down -v"
echo ""
echo "  服务器上所有 MealLog 实例:"
docker ps --format '  {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E '^(.*-mysql|.*-backend|.*-frontend)' || true
echo ""
echo "  安全组提醒: 请在云控制台为每个实例开放对应的 FRONTEND_PORT 端口"
echo ""

