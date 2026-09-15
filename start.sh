#!/bin/bash

# 饮食记录应用 - 快速启动脚本

echo "🍽️ 饮食记录应用启动中..."
echo ""

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未找到 Docker，请先安装 Docker Desktop"
    exit 1
fi

# 检查Docker是否运行
if ! docker info &> /dev/null; then
    echo "❌ 错误: Docker 未运行，请启动 Docker Desktop"
    exit 1
fi

# 检查docker-compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: 未找到 docker-compose"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo ""

# 停止旧容器（如果存在）
# 注：本地启动默认加载 docker-compose.override.yml，即“生产基线 + 热更新”
echo "🔄 停止现有容器..."
docker-compose down 2>/dev/null

# 构建并启动所有服务
echo "🚀 构建并启动所有服务（含热更新）..."
docker-compose up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态:"
docker-compose ps

echo ""
echo "🎉 启动完成！"
echo ""
echo "📱 访问地址:"
echo "   前端应用: http://localhost:3000"
echo "   后端API:  http://localhost:3001"
echo "   数据库:   localhost:3306"
echo ""
echo "🔧 管理命令:"
echo "   查看日志:    docker-compose logs -f"
echo "   停止服务:    docker-compose down"
echo "   重启服务:    docker-compose restart"
echo ""
echo "💡 如需纯生产模式（无热更新）运行："
echo "   docker-compose -f docker-compose.yml up -d --build"
echo ""
