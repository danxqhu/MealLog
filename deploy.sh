#!/bin/bash

# ============================================
# MealLog 饮食记录应用 - 阿里云一键部署脚本
# ============================================
# 使用方法:
#   1. 将整个项目上传到阿里云 ECS
#   2. chmod +x deploy.sh
#   3. ./deploy.sh
# ============================================

set -e

echo "=========================================="
echo "  MealLog 饮食记录应用 - 云端部署"
echo "=========================================="
echo ""

# ---------- 1. 环境检查 ----------
echo "[1/5] 检查服务器环境..."

if ! command -v docker &> /dev/null; then
    echo "  Docker 未安装，正在自动安装..."
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
    echo "  Docker 安装完成"
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "  docker-compose 未安装，正在自动安装..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "  docker-compose 安装完成"
fi

# 确定使用的 compose 命令
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

echo "  Docker: $(docker --version)"
echo "  Compose: $($COMPOSE_CMD version)"
echo ""

# ---------- 2. 环境变量配置 ----------
echo "[2/5] 检查环境变量配置..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo ""
        echo "  !! 重要: 已生成 .env 文件，请先修改其中的密码和密钥 !!"
        echo "  编辑命令: vim .env"
        echo ""
        read -p "  是否现在编辑 .env 文件？(y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-vim} .env
        else
            echo "  请稍后手动编辑 .env 文件后再运行此脚本"
            exit 1
        fi
    fi
else
    echo "  .env 文件已存在，跳过生成"
fi

# 校验 .env 中是否仍包含示例密码
if grep -qE "your_strong_|your_random_" .env 2>/dev/null; then
    echo ""
    echo "  ❌ 错误: .env 文件中仍包含示例密码/密钥，请先修改！"
    echo "  编辑命令: vim .env"
    exit 1
fi
echo ""

# 云端部署：显式只加载 docker-compose.yml，跳过 docker-compose.override.yml
# 这样部署得到的是纯生产模式（nginx 静态托管 + node 直启，无热更新）
COMPOSE_FILES="-f docker-compose.yml"

# ---------- 3. 停止旧服务 ----------
echo "[3/5] 停止旧服务（生产模式）..."
$COMPOSE_CMD $COMPOSE_FILES down 2>/dev/null || true
echo "  旧服务已清理"
echo ""

# ---------- 4. 构建并启动 ----------
echo "[4/5] 构建并启动所有服务（生产模式）..."
$COMPOSE_CMD $COMPOSE_FILES up -d --build
echo ""

# ---------- 5. 等待并验证 ----------
echo "[5/5] 等待服务就绪..."
sleep 10

# 获取服务器 IP
SERVER_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo ""
echo "  服务状态:"
$COMPOSE_CMD ps
echo ""
echo "  访问地址（宿主机 3000 端口映射到容器 nginx 80）:"
echo "    应用入口:  http://${SERVER_IP}:3000"
echo "    后端 API:  http://${SERVER_IP}:3001"
echo ""
echo "  管理命令:"
echo "    查看日志:    $COMPOSE_CMD $COMPOSE_FILES logs -f"
echo "    重启服务:    $COMPOSE_CMD $COMPOSE_FILES restart"
echo "    停止服务:    $COMPOSE_CMD $COMPOSE_FILES down"
echo "    更新部署:    git pull && ./deploy.sh"
echo ""
echo "  阿里云安全组提醒:"
echo "    请确保 ECS 安全组已开放 3000 端口（前端入口）"
echo "    如需直接访问后端，还需开放 3001 端口"
echo "    若希望直接以 80 端口对外提供访问，可修改 docker-compose.yml"
echo "    中 frontend 的端口映射为 \"80:80\"，或使用反向代理"
echo ""
