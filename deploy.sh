#!/bin/bash

# ============================================
# MealLog 饮食记录应用 - 阿里云一键部署脚本（服务器端）
# ============================================
# 背景：免费 ECS 内存小，无法承载前端构建。正确流程是：
#   本地构建前端产物并推送到 GitHub deploy 分支，
#   服务器执行 ./deploy.sh → 自动拉取 deploy 分支并部署（本脚本）。
#
# 本地发布（每次更新，在 Mac 上执行）:
#   cd frontend && npm run build && cd ..
#   git checkout -B deploy main && git add -f frontend/build
#   git commit -m "release: 构建产物" && git push -f origin deploy
#
# 服务器首次部署：
#   1. git clone --depth 1 -b deploy https://github.com/danxqhu/MealLog.git meallog
#   2. cd meallog && cp .env.example .env && vim .env   # 修改密码和密钥
#   3. chmod +x deploy.sh && ./deploy.sh
#
# 之后每次更新：直接在服务器运行 ./deploy.sh（自动拉取最新发布代码）
# ============================================

set -e

echo "=========================================="
echo "  MealLog 饮食记录应用 - 云端部署"
echo "=========================================="
echo ""

# ---------- 0. 拉取最新发布代码 ----------
# 服务器只需克隆 deploy 分支，本脚本自动同步到远程最新再部署。
# 使用 fetch + reset --hard：deploy 分支允许强推重写历史，ff-only 拉取会失败。
# .env 是未跟踪文件，reset --hard 不会动它。
# 拉取失败 = 本地是旧代码，继续部署只会原样重发旧版，直接中止不做后续步骤。
# 若在 git 仓库外运行（例如直接上传的文件），则跳过拉取。
if git rev-parse --git-dir &> /dev/null; then
    echo "[0/6] 拉取最新发布代码..."
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    # 保留并展示真实报错（权限/网络/认证），不再静默吞掉
    if ! FETCH_ERR=$(git fetch origin "$CURRENT_BRANCH" 2>&1); then
        echo ""
        echo "  ❌ 错误: 拉取 origin/$CURRENT_BRANCH 失败，已中止部署（未停服、未重建，线上保持现状）"
        echo "  git 报错信息:"
        echo "$FETCH_ERR" | sed 's/^/    /'
        echo "  常见原因: .git 目录权限混乱（混用 root/ubuntu 操作过 git）、网络不通 GitHub、凭据失效"
        echo "  权限类问题可执行: sudo chown -R ubuntu:ubuntu $(pwd)"
        echo "  也可手动同步后重试: git fetch origin $CURRENT_BRANCH && git reset --hard origin/$CURRENT_BRANCH"
        exit 1
    fi
    if ! git reset --hard -q "origin/$CURRENT_BRANCH"; then
        echo "  ❌ 错误: 重置到 origin/$CURRENT_BRANCH 失败（可能有文件属主/权限问题），已中止部署"
        exit 1
    fi
    echo "  已同步到 origin/$CURRENT_BRANCH 最新代码: $(git log --oneline -1)"
    echo ""
else
    echo "[0/6] 非 git 仓库，跳过代码拉取"
    echo ""
fi

# ---------- 1. 环境检查 ----------
echo "[1/6] 检查服务器环境..."

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
echo "[2/6] 检查环境变量配置..."

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
echo "[3/6] 停止旧服务（生产模式）..."
$COMPOSE_CMD $COMPOSE_FILES down 2>/dev/null || true
echo "  旧服务已清理"
echo ""

# ---------- 4. 构建并启动 ----------
# 前端镜像 = nginx + 本地预构建的静态产物（deploy 分支自带 build/，秒级构建）
# 后端镜像 = 仅安装 6 个生产依赖（--omit=dev），低内存可安全完成
echo "[4/6] 构建并启动所有服务（生产模式）..."
$COMPOSE_CMD $COMPOSE_FILES up -d --build
echo ""

# ---------- 5. 等待并验证 ----------
echo "[5/6] 等待服务就绪..."
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
echo "  访问方式（本应用不映射任何宿主机端口）:"
echo "    对外访问由独立总反向代理接管 80/443，按二级域名转发到本应用 frontend:80（compose 服务名）"
echo "    总代理配置见仓库 reverse-proxy/ 目录，业务入口: https://<你的二级域名>"
echo "    临时调试可在 docker-compose.yml 手动加回 ports 映射"
echo ""
echo "  ⚠️ 启动顺序: 必须先启动本应用（创建共享网络 meal-log-network），再启动 reverse-proxy"
echo ""
echo "  管理命令:"
echo "    查看日志:    $COMPOSE_CMD $COMPOSE_FILES logs -f"
echo "    重启服务:    $COMPOSE_CMD $COMPOSE_FILES restart"
echo "    停止服务:    $COMPOSE_CMD $COMPOSE_FILES down"
echo "    更新部署:    ./deploy.sh  （脚本自动拉取最新发布代码）"
echo ""
echo "  云安全组提醒:"
echo "    只需放行 80/443（总反向代理占用），业务端口无需对外开放"
echo ""
