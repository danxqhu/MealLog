# 🚀 饮食记录应用 - 使用指南

## ✅ 问题已解决

如果在Docker构建时出现 `Module not found: Error: Can't resolve './App'` 错误，请确保使用最新代码。

**修复内容：**
- 移除了 `frontend/src/api/index.js` 中的错误导入语句
- 应用现已成功构建并运行

## 📋 快速开始

### 1️⃣ 启动应用

```bash
# 方法1: 使用快速启动脚本（推荐）
./start.sh

# 方法2: 手动启动
docker-compose up -d --build
```

### 2️⃣ 访问应用

打开浏览器访问：**http://localhost:3000**

### 3️⃣ 使用应用

#### 📅 日历视图
- **查看月度日历**：默认显示当前月份
- **切换月份**：点击左右箭头按钮
- **查看/添加记录**：点击任意日期
- **颜色标识**：
  - 🟢 渐变色背景 = 有饮食记录
  - ⚪ 灰色背景 = 无记录

#### ✏️ 添加饮食记录
1. 点击某一天
2. 点击"添加饮食记录"按钮
3. 填写信息：
   - **店名**：餐厅或外卖名称（如：麦当劳、肯德基）
   - **金额**：消费金额
4. 点击"保存"

#### 🗑️ 删除记录
在日期弹窗中，点击记录旁边的"删除"按钮

#### 📊 统计视图
1. 点击顶部"📊 统计"按钮
2. 选择时间维度：
   - **月度**：查看单月数据
   - **季度**：查看季度汇总
   - **年度**：查看全年趋势图表
3. 使用下拉菜单选择具体年份/月份/季度

#### 📈 统计数据
- **总支出**：选定时间段内的总消费
- **用餐次数**：总共用餐的次数
- **活跃天数**：有记录的独有天数
- **平均每次**：平均每餐消费

## 🔧 常用命令

### Docker 管理
```bash
# 查看所有容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 停止所有服务
docker-compose down

# 重启所有服务
docker-compose restart

# 重新启动某个服务
docker-compose restart backend
```

### 开发模式

#### 后端开发
```bash
cd backend
npm install
npm run dev  # 开启热重载
```

#### 前端开发
```bash
cd frontend
npm install
npm start    # 自动打开浏览器
```

## 🌐 API 测试示例

### 添加记录
```bash
curl -X POST http://localhost:3001/api/meals \
  -H "Content-Type: application/json" \
  -d '{"meal_date":"2026-09-14","restaurant_name":"麦当劳","amount":35.50}'
```

### 查询某天记录
```bash
curl "http://localhost:3001/api/meals/2026-09-14"
```

### 查询月份范围
```bash
curl "http://localhost:3001/api/meals/range?startDate=2026-09-01&endDate=2026-09-30"
```

### 月度统计
```bash
curl "http://localhost:3001/api/stats/monthly?year=2026&month=9"
```

## 🎯 功能特性一览

### ✅ 已实现
- [x] 日历视图展示
- [x] 饮食记录增删改查
- [x] 月度/季度/年度统计
- [x] 柱状图数据可视化
- [x] 响应式设计
- [x] Docker一键部署
- [x] 数据库自动初始化

### 📱 界面预览

**日历页面**
- 渐变紫色头部导航
- 可切换的月历网格
- 彩色标记有/无记录
- 悬停动画效果

**统计页面**
- 月/季/年视图切换
- 4个统计卡片展示
- 年度柱状图趋势
- 响应式布局

## ❓ 常见问题

### Q: Docker构建失败
**A:** 检查是否在根目录运行，并确保Docker已安装

### Q: 页面显示空白
**A:** 检查浏览器控制台错误，确认后端API正常

### Q: 无法连接数据库
**A:** 等待MySQL完全启动（约10-15秒），检查容器状态

### Q: 修改代码后没有更新
**A:** 
- Docker模式：重启容器 `docker-compose restart backend`
- 开发模式：使用 `npm run dev` 开启热重载

## 📚 技术细节

### 数据库结构
```sql
CREATE TABLE meals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meal_date DATE NOT NULL,
  restaurant_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 端口映射
| 服务 | 宿主机端口 | 容器端口 |
|-----|----------|---------|
| 前端 | 3000 | 80 |
| 后端 | 3001 | 3001 |
| MySQL | 3306 | 3306 |

### 数据持久化
- MySQL数据：Docker Volume (`mysql_data`)
- 代码同步：后端源码挂载为Volume（支持热重载）

## 🎨 UI配色方案

- 主色调：`#667eea` → `#764ba2` (紫色渐变)
- 成功色：`#00b894` (绿色)
- 警告色：`#fdcb6e` (黄色)
- 危险色：`#ff6b6b` (红色)

## 📞 技术支持

如有问题，请：
1. 查看 `docker-compose logs -f` 获取日志
2. 检查 `docker-compose ps` 确认服务状态
3. 参考 README.md 中的详细文档

---

**享受你的饮食记录之旅！🍽️✨**
