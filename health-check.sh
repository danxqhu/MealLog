#!/bin/bash

# 应用健康检查脚本

echo "🍽️ 饮食记录应用 - 健康检查"
echo "=============================="
echo ""

# 确定使用的 compose 命令
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

HAS_ERROR=0

# 检查前端
echo "📱 检查前端服务..."
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost)
if [ "$FRONTEND" == "200" ]; then
    echo "✅ 前端运行正常 (HTTP $FRONTEND)"
else
    echo "❌ 前端未响应 (HTTP $FRONTEND)"
    HAS_ERROR=1
fi

# 检查后端
echo ""
echo "🔧 检查后端API..."
BACKEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$BACKEND" == "200" ]; then
    RESPONSE=$(curl -s http://localhost:3001/health)
    echo "✅ 后端运行正常 (HTTP $BACKEND)"
    echo "   状态: $RESPONSE"
else
    echo "❌ 后端未响应 (HTTP $BACKEND)"
    HAS_ERROR=1
fi

# 检查数据库连接（通过后端 /health 端点间接验证）
echo ""
echo "💾 检查MySQL数据库..."
DB_CHECK=$(docker exec meal-log-mysql mysqladmin ping -h localhost 2>/dev/null)
if echo "$DB_CHECK" | grep -q "alive"; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库未响应"
    HAS_ERROR=1
fi

# 显示容器状态
echo ""
echo "📊 Docker容器状态:"
$COMPOSE_CMD ps 2>/dev/null | grep -v "level=warning"

# 汇总结果
echo ""
echo "=============================="
if [ "$HAS_ERROR" -eq 0 ]; then
    echo "✅ 健康检查完成，所有服务正常！"
else
    echo "❌ 健康检查完成，部分服务异常，请检查上方日志！"
fi
echo ""
