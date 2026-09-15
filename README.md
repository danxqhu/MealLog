# 🍽️ 饮食记录应用 (Meal Log)

一个用于记录日常饮食开支的应用，支持日历视图和统计数据展示。

## ✨ 功能特性

- 📅 **日历视图**：以月历形式展示每天的饮食记录
- 💰 **消费记录**：记录每次饮食的店名和花费
- 📊 **统计分析**：按月、季度、年度展示消费统计
- 🎨 **美观界面**：现代化的UI设计，支持响应式布局
- 🐳 **Docker部署**：一键部署，开箱即用

## 🛠️ 技术栈

### 前端
- React 18
- Recharts (数据可视化)
- CSS3 (渐变动画)

### 后端
- Node.js + Express
- MySQL 8.0
- RESTful API

### 部署
- Docker & Docker Compose
- Nginx (前端服务器)

## 📦 安装与部署

### 方式一：Docker 部署（推荐）

1. 克隆项目或确保在项目根目录
2. 启动所有服务：

```bash
# 方法1: 使用快速启动脚本
./start.sh

# 方法2: 直接使用docker-compose
docker-compose up -d --build
```

3. 等待服务启动后访问：
   - 前端：http://localhost:3000
   - 后端API：http://localhost:3001
   - MySQL数据库：localhost:3306

### 方式二：本地开发

#### 后端设置

```bash
cd backend
npm install
# 创建 .env 文件
cp .env.example .env
npm run dev
```

#### 前端设置

```bash
cd frontend
npm install
npm start
```

访问 http://localhost:3000

## 📁 项目结构

```
MealLog/
├── backend/
│   ├── src/
│   │   ├── database.js    # 数据库连接和初始化
│   │   ├── routes.js      # API路由
│   │   └── index.js       # 应用入口
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/           # API调用
│   │   ├── components/    # React组件
│   │   │   ├── App.js     # 主应用
│   │   │   ├── Calendar.js # 日历视图
│   │   │   ├── MealModal.js # 饮食记录弹窗
│   │   │   └── StatsChart.js # 统计图表
│   │   └── index.js
│   ├── public/
│   ├── nginx.conf
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🔌 API接口

### 获取指定日期的餐饮记录
```
GET /api/meals/:date
```

### 添加餐饮记录
```
POST /api/meals
Body: {
  meal_date: "2025-09-14",
  restaurant_name: "麦当劳",
  amount: 35.50
}
```

### 更新餐饮记录
```
PUT /api/meals/:id
Body: {
  restaurant_name: "肯德基",
  amount: 40.00
}
```

### 删除餐饮记录
```
DELETE /api/meals/:id
```

### 获取日期范围的餐饮记录
```
GET /api/meals/range?startDate=2025-09-01&endDate=2025-09-30
```

### 月度统计
```
GET /api/stats/monthly?year=2025&month=9
```

### 季度统计
```
GET /api/stats/quarterly?year=2025&quarter=3
```

### 年度统计
```
GET /api/stats/yearly?year=2025
```

## 🎯 使用说明

1. **查看日历**：默认显示日历视图，可以切换月份
2. **记录饮食**：点击某一天，弹出模态框
3. **添加记录**：点击"添加饮食记录"，填写店名和金额
4. **查看详情**：点击某天查看已记录的饮食
5. **删除记录**：在详情弹窗中可以删除记录
6. **查看统计**：切换到"统计"标签，选择月/季/年查看消费趋势

## 🔧 环境变量配置

### 后端 (.env)
```env
PORT=3001
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=meallog_password
DB_NAME=meal_log
```

### 前端 (.env)
```env
REACT_APP_API_URL=http://localhost:3001
```

## 📝 注意事项

- 首次启动需要等待MySQL初始化完成
- 数据库会自动创建meals表
- 所有数据存储在本地的MySQL容器中
- 数据卷会持久化数据库文件

## 🚀 停止服务

```bash
docker-compose down
```

如果需要删除数据卷：
```bash
docker-compose down -v
```

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License
