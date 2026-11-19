const mysql = require('mysql2/promise');

// 预置常见食物库（能量统一按千卡 kcal 存储：固体为每 100 克，液体为每 100 毫升）
// 格式：[名称, 每100能量(kcal), 类型 solid|liquid, 蛋白质(g), 脂肪(g), 碳水化合物(g)]
// 注：数值参考常见食物成分表，为每 100g 可食部的大致值
const SEED_FOODS = [
  // 主食
  ['米饭', 116, 'solid', 2.6, 0.4, 25.9], ['白粥', 46, 'solid', 1.0, 0.2, 9.9], ['糙米饭', 112, 'solid', 2.7, 0.8, 25.0], ['面条（熟）', 110, 'solid', 4.5, 0.7, 22.8],
  ['馒头', 223, 'solid', 7.0, 1.1, 44.2], ['花卷', 217, 'solid', 6.4, 1.0, 46.0], ['包子（猪肉馅）', 227, 'solid', 7.5, 7.1, 34.0], ['饺子（猪肉馅，熟）', 240, 'solid', 10.0, 9.0, 28.0],
  ['烧麦', 243, 'solid', 6.8, 8.5, 35.0], ['油条', 388, 'solid', 6.9, 17.6, 51.0], ['油饼', 399, 'solid', 6.9, 19.3, 49.7], ['煎饼果子', 240, 'solid', 7.3, 9.2, 32.6],
  ['面包（吐司）', 285, 'solid', 8.3, 3.7, 56.2], ['全麦面包', 246, 'solid', 9.5, 2.2, 48.0], ['蛋糕', 348, 'solid', 4.5, 12.0, 54.0], ['饼干（苏打）', 408, 'solid', 8.4, 7.0, 78.0],
  ['玉米（熟）', 112, 'solid', 3.8, 1.2, 22.0], ['红薯（熟）', 90, 'solid', 1.1, 0.2, 20.4], ['土豆（熟）', 77, 'solid', 2.0, 0.4, 16.6], ['山药（熟）', 57, 'solid', 1.9, 0.2, 12.4],
  ['南瓜（熟）', 23, 'solid', 0.7, 0.1, 5.3], ['芋头（熟）', 81, 'solid', 2.2, 0.2, 18.1], ['燕麦片', 377, 'solid', 15.0, 6.7, 61.0], ['小米粥', 31, 'solid', 0.7, 0.1, 6.6],
  ['炒饭', 180, 'solid', 4.0, 4.5, 30.0], ['炒面', 197, 'solid', 5.0, 4.5, 34.0], ['馄饨', 120, 'solid', 6.0, 3.0, 17.0], ['米线', 109, 'solid', 1.6, 0.3, 24.0],
  ['粽子（白米）', 195, 'solid', 3.2, 0.6, 43.0], ['汤圆', 311, 'solid', 4.0, 8.0, 55.0],
  // 肉蛋奶
  ['鸡蛋（煮）', 144, 'solid', 13.3, 8.8, 2.8], ['鸡蛋（煎）', 199, 'solid', 11.7, 11.0, 2.5], ['鸭蛋（咸）', 190, 'solid', 12.6, 13.1, 5.3], ['鹌鹑蛋（煮）', 160, 'solid', 12.8, 11.1, 2.1],
  ['鸡胸肉（煮）', 133, 'solid', 24.5, 4.0, 0], ['鸡腿肉（煮）', 181, 'solid', 20.0, 11.0, 0], ['炸鸡（腿翅）', 279, 'solid', 20.5, 19.0, 6.0],
  ['烤鸭', 436, 'solid', 19.0, 38.0, 2.0], ['红烧肉', 478, 'solid', 12.0, 45.0, 6.0], ['猪肉（瘦，煮）', 143, 'solid', 20.3, 6.2, 1.0], ['培根', 181, 'solid', 20.0, 10.5, 1.0],
  ['火腿肠', 212, 'solid', 14.0, 10.4, 15.6], ['腊肠', 508, 'solid', 18.0, 45.0, 7.0], ['牛肉（瘦，煮）', 106, 'solid', 19.5, 3.0, 0], ['牛腩（炖）', 250, 'solid', 17.0, 20.0, 0],
  ['羊肉（煮）', 203, 'solid', 19.0, 14.0, 0], ['酱牛肉', 246, 'solid', 26.0, 14.0, 3.0], ['猪肝（煮）', 129, 'solid', 19.6, 4.8, 2.0], ['鸡爪（卤）', 254, 'solid', 23.9, 16.4, 2.0],
  ['牛奶', 54, 'liquid', 3.0, 3.2, 3.4], ['脱脂牛奶', 33, 'liquid', 3.4, 0.2, 4.9], ['酸奶（原味）', 72, 'liquid', 2.5, 2.7, 9.3], ['奶酪', 328, 'solid', 25.7, 23.5, 3.5],
  ['豆浆（无糖）', 31, 'liquid', 2.5, 1.5, 1.6], ['豆腐（北）', 98, 'solid', 12.2, 4.8, 2.0], ['豆腐（南）', 57, 'solid', 6.2, 2.4, 2.1], ['豆腐脑', 45, 'solid', 5.9, 1.6, 2.8],
  ['豆干', 140, 'solid', 14.0, 6.0, 8.0], ['千张', 162, 'solid', 22.0, 6.5, 4.5], ['腐竹', 459, 'solid', 44.6, 21.7, 22.3], ['毛豆（煮）', 123, 'solid', 13.1, 5.0, 8.3],
  // 水产
  ['草鱼（蒸）', 113, 'solid', 17.9, 4.0, 0], ['鲈鱼（蒸）', 105, 'solid', 18.6, 3.4, 0], ['三文鱼', 139, 'solid', 20.0, 6.3, 0], ['带鱼（炸）', 229, 'solid', 16.0, 16.0, 6.0],
  ['黄鱼（烧）', 164, 'solid', 17.0, 8.0, 7.0], ['虾（白灼）', 93, 'solid', 19.0, 1.5, 0], ['基围虾（烤）', 126, 'solid', 18.0, 4.0, 3.0], ['蟹（蒸）', 103, 'solid', 17.5, 3.2, 1.5],
  ['蛤蜊（煮）', 62, 'solid', 10.3, 1.5, 2.5], ['鱿鱼（烤）', 84, 'solid', 17.4, 1.2, 2.0], ['生蚝（蒸）', 73, 'solid', 6.0, 2.0, 8.0], ['海参', 63, 'solid', 15.0, 0.3, 1.0],
  ['鱼丸（煮）', 118, 'solid', 10.0, 4.0, 12.0], ['鱿鱼须（炸）', 196, 'solid', 16.0, 10.0, 9.0],
  // 蔬菜
  ['青菜（煮）', 15, 'solid', 1.2, 0.3, 2.2], ['白菜（煮）', 16, 'solid', 1.2, 0.2, 2.8], ['菠菜（煮）', 28, 'solid', 2.6, 0.3, 4.0], ['西兰花（煮）', 36, 'solid', 4.1, 0.6, 4.3],
  ['生菜', 15, 'solid', 1.3, 0.3, 2.2], ['油麦菜（煮）', 15, 'solid', 1.4, 0.3, 2.3], ['芹菜（煮）', 22, 'solid', 1.2, 0.4, 4.5], ['黄瓜', 16, 'solid', 0.8, 0.3, 2.9],
  ['番茄', 20, 'solid', 0.9, 0.2, 4.2], ['茄子（烧）', 90, 'solid', 1.1, 5.0, 10.0], ['豆角（煮）', 34, 'solid', 2.5, 0.3, 6.5], ['韭菜（炒）', 46, 'solid', 2.4, 1.5, 5.0],
  ['洋葱', 40, 'solid', 1.1, 0.2, 9.0], ['青椒', 22, 'solid', 1.0, 0.2, 4.5], ['胡萝卜（煮）', 34, 'solid', 1.3, 0.3, 7.0], ['冬瓜（煮）', 12, 'solid', 0.4, 0.2, 2.4],
  ['丝瓜（煮）', 20, 'solid', 1.0, 0.2, 4.0], ['苦瓜（煮）', 22, 'solid', 1.0, 0.3, 4.5], ['蘑菇（煮）', 24, 'solid', 2.4, 0.1, 3.6], ['香菇（煮）', 26, 'solid', 1.2, 0.3, 5.2],
  ['木耳（水发，煮）', 27, 'solid', 1.5, 0.2, 5.9], ['海带（水发）', 13, 'solid', 1.1, 0.1, 1.6], ['紫菜（蛋花汤）', 25, 'liquid', 1.5, 0.5, 3.5],
  ['豆芽（煮）', 16, 'solid', 1.4, 0.1, 2.5], ['藕（煮）', 72, 'solid', 1.9, 0.2, 16.4], ['芦笋（煮）', 22, 'solid', 2.6, 0.2, 3.3],
  ['炒时蔬（快餐）', 60, 'solid', 1.8, 4.0, 4.5], ['酸辣土豆丝', 74, 'solid', 1.0, 3.5, 9.5], ['干煸四季豆', 120, 'solid', 2.5, 8.0, 9.0],
  ['麻婆豆腐', 135, 'solid', 8.0, 9.0, 4.0], ['西红柿炒鸡蛋', 110, 'solid', 6.0, 7.0, 6.0], ['青椒炒肉丝', 130, 'solid', 10.0, 8.0, 4.0],
  // 水果
  ['苹果', 53, 'solid', 0.2, 0.2, 13.5], ['香蕉', 93, 'solid', 1.4, 0.2, 22.0], ['橙子', 48, 'solid', 0.8, 0.2, 10.5], ['橘子', 44, 'solid', 0.7, 0.2, 10.0],
  ['葡萄', 45, 'solid', 0.4, 0.3, 10.3], ['西瓜', 31, 'solid', 0.5, 0.1, 7.6], ['梨', 51, 'solid', 0.3, 0.1, 13.0], ['桃', 42, 'solid', 0.6, 0.1, 10.0],
  ['猕猴桃', 61, 'solid', 0.8, 0.6, 13.0], ['草莓', 32, 'solid', 1.0, 0.3, 6.5], ['蓝莓', 57, 'solid', 0.5, 0.3, 13.0], ['芒果', 35, 'solid', 0.6, 0.2, 8.0],
  ['菠萝', 44, 'solid', 0.5, 0.1, 10.5], ['柚子', 42, 'solid', 0.7, 0.2, 9.5], ['火龙果', 55, 'solid', 1.1, 0.3, 12.0], ['樱桃', 46, 'solid', 1.1, 0.2, 10.2],
  ['荔枝', 71, 'solid', 0.9, 0.2, 16.6], ['龙眼', 71, 'solid', 1.2, 0.1, 16.6], ['哈密瓜', 34, 'solid', 0.5, 0.1, 7.7], ['牛油果', 161, 'solid', 2.0, 13.0, 8.0],
  ['椰子肉', 354, 'solid', 4.0, 33.0, 10.0], ['枣（鲜）', 122, 'solid', 1.2, 0.2, 30.0], ['柿子', 71, 'solid', 0.4, 0.1, 17.1], ['石榴', 72, 'solid', 0.7, 0.3, 17.0],
  ['木瓜', 27, 'solid', 0.6, 0.1, 6.2], ['山竹', 73, 'solid', 0.5, 0.3, 17.0], ['榴莲', 147, 'solid', 1.4, 5.0, 25.0],
  // 坚果零食
  ['花生（炒）', 601, 'solid', 24.8, 48.0, 18.0], ['瓜子（葵花籽，炒）', 606, 'solid', 22.6, 52.8, 10.0], ['核桃仁', 646, 'solid', 15.0, 58.0, 17.0],
  ['杏仁', 578, 'solid', 22.0, 50.0, 10.0], ['腰果（炒）', 557, 'solid', 17.3, 36.7, 41.6], ['开心果', 613, 'solid', 20.0, 50.0, 21.0], ['夏威夷果', 718, 'solid', 7.9, 71.1, 12.0],
  ['碧根果', 685, 'solid', 9.0, 70.0, 6.0], ['板栗（熟）', 185, 'solid', 4.2, 2.0, 40.0], ['薯片', 548, 'solid', 5.0, 37.0, 49.0], ['巧克力（黑）', 589, 'solid', 5.0, 38.0, 57.0],
  ['牛奶糖', 380, 'solid', 2.0, 6.0, 80.0], ['冰淇淋', 127, 'solid', 3.0, 6.0, 16.0], ['雪糕', 120, 'solid', 2.0, 5.0, 17.0], ['布丁', 90, 'solid', 1.5, 2.0, 16.0],
  ['果冻', 65, 'solid', 0.5, 0.0, 16.0], ['爆米花', 387, 'solid', 10.0, 12.0, 60.0], ['海苔（烤）', 332, 'solid', 25.0, 5.0, 48.0], ['牛肉干', 382, 'solid', 40.0, 14.0, 25.0],
  ['辣条', 330, 'solid', 8.0, 20.0, 28.0], ['鸭脖（卤）', 187, 'solid', 19.0, 10.0, 4.0], ['豆干（卤）', 195, 'solid', 16.0, 12.0, 7.0],
  // 饮品
  ['可乐', 43, 'liquid', 0.1, 0.0, 10.6], ['雪碧', 41, 'liquid', 0.0, 0.0, 10.2], ['橙汁', 45, 'liquid', 0.7, 0.2, 10.4], ['苹果汁', 45, 'liquid', 0.1, 0.1, 11.2],
  ['矿泉水', 0, 'liquid', 0, 0, 0], ['茶水（无糖）', 0, 'liquid', 0, 0, 0], ['咖啡（黑）', 2, 'liquid', 0.1, 0, 0.3],
  ['拿铁（中杯）', 40, 'liquid', 2.0, 1.6, 3.5], ['卡布奇诺', 45, 'liquid', 2.2, 1.8, 4.0], ['奶茶（珍珠）', 70, 'liquid', 0.8, 2.0, 12.0], ['奶茶（无料）', 50, 'liquid', 0.7, 1.5, 8.5],
  ['柠檬茶', 30, 'liquid', 0.1, 0, 7.5], ['酸梅汤', 40, 'liquid', 0.3, 0, 10.0], ['椰汁', 48, 'liquid', 0.5, 2.0, 7.0], ['花生奶', 50, 'liquid', 1.2, 1.8, 7.0],
  ['啤酒', 32, 'liquid', 0.3, 0, 3.1], ['红酒', 72, 'liquid', 0.1, 0, 2.5], ['白酒（52度）', 298, 'liquid', 0, 0, 0.1], ['米酒', 90, 'liquid', 0.8, 0, 8.0],
  ['运动饮料', 20, 'liquid', 0, 0, 4.8], ['维他奶（原味）', 56, 'liquid', 1.3, 0.8, 10.3], ['蜂蜜水', 35, 'liquid', 0.1, 0, 8.6],
  // 快餐/外卖常见
  ['汉堡（鸡肉）', 240, 'solid', 10.0, 9.0, 29.0], ['汉堡（牛肉）', 260, 'solid', 12.0, 10.0, 30.0], ['三明治', 200, 'solid', 7.0, 6.0, 28.0],
  ['披萨（芝士）', 266, 'solid', 10.0, 9.0, 37.0], ['炸鸡块（快餐）', 279, 'solid', 13.0, 16.0, 22.0], ['薯条（炸）', 312, 'solid', 3.8, 15.0, 40.0],
  ['鸡米花', 320, 'solid', 14.0, 18.0, 27.0], ['蛋挞', 350, 'solid', 5.0, 18.0, 42.0], ['寿司（三文鱼）', 150, 'solid', 6.0, 2.0, 27.0], ['饭团', 180, 'solid', 3.5, 1.5, 38.0],
  ['拉面（一碗）', 130, 'solid', 4.5, 3.0, 21.0], ['麻辣烫', 95, 'solid', 5.0, 5.0, 8.0], ['冒菜', 110, 'solid', 5.5, 6.0, 9.0], ['烤肉（牛肉）', 250, 'solid', 20.0, 18.0, 2.0],
  ['烤鸡翅', 220, 'solid', 18.0, 15.0, 3.0], ['烤韭菜', 90, 'solid', 2.4, 6.0, 7.0], ['烤生蚝（一只）', 80, 'solid', 5.0, 2.0, 10.0],
  ['盖浇饭（回锅肉）', 150, 'solid', 6.0, 6.0, 20.0], ['盖浇饭（鱼香肉丝）', 140, 'solid', 5.0, 5.0, 20.0], ['黄焖鸡', 160, 'solid', 14.0, 9.0, 6.0],
  ['螺蛳粉', 120, 'solid', 3.5, 4.5, 17.0], ['热干面', 198, 'solid', 6.0, 7.0, 28.0], ['炸酱面', 180, 'solid', 6.0, 5.0, 27.0], ['刀削面', 115, 'solid', 3.5, 1.5, 24.0],
  ['肠粉', 120, 'solid', 3.0, 3.0, 20.0], ['肉夹馍', 280, 'solid', 8.5, 10.0, 39.0], ['灌饼（鸡蛋）', 260, 'solid', 7.0, 11.0, 33.0]
];

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'meallog_password',
  database: process.env.DB_NAME || 'meal_log',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: ['DATE']  // DATE 类型直接返回 'YYYY-MM-DD' 字符串，避免时区偏移
});

// 初始化数据库表
const initDatabase = async () => {
  try {
    const connection = await pool.getConnection();

    // 创建 users 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        security_question VARCHAR(255) NOT NULL,
        security_answer VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 检查 meals 表是否存在
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'meals'",
      [process.env.DB_NAME || 'meal_log']
    );

    if (tables.length > 0) {
      // meals 表已存在，检查是否有 user_id 列
      const [cols] = await connection.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'meals' AND COLUMN_NAME = 'user_id'",
        [process.env.DB_NAME || 'meal_log']
      );

      if (cols.length === 0) {
        // 删除旧数据（无用户归属），然后添加 user_id 列
        await connection.execute('DELETE FROM meals');
        await connection.execute(`
          ALTER TABLE meals
            ADD COLUMN user_id INT NOT NULL,
            ADD CONSTRAINT fk_meals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            ADD INDEX idx_user_date (user_id, meal_date)
        `);
        console.log('Migrated meals table: added user_id column');
      }

      // 检查是否有 notes 列
      const [notesCols] = await connection.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'meals' AND COLUMN_NAME = 'notes'",
        [process.env.DB_NAME || 'meal_log']
      );
      if (notesCols.length === 0) {
        await connection.execute('ALTER TABLE meals ADD COLUMN notes TEXT DEFAULT NULL');
        console.log('Migrated meals table: added notes column');
      }

      // 检查是否有 dining_type 列
      const [diningCols] = await connection.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'meals' AND COLUMN_NAME = 'dining_type'",
        [process.env.DB_NAME || 'meal_log']
      );
      if (diningCols.length === 0) {
        await connection.execute("ALTER TABLE meals ADD COLUMN dining_type VARCHAR(20) DEFAULT 'dine_out'");
        console.log('Migrated meals table: added dining_type column');
      }
    } else {
      // 创建 meals 表（带 user_id）
      await connection.execute(`
        CREATE TABLE meals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          meal_date DATE NOT NULL,
          restaurant_name VARCHAR(255) NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          notes TEXT DEFAULT NULL,
          dining_type VARCHAR(20) DEFAULT 'dine_out',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_date (user_id, meal_date),
          CONSTRAINT fk_meals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }

    // 创建 food_items 食物库表（全局共享，能量统一按 kcal 存储：固体每 100 克 / 液体每 100 毫升）
    // 三大营养素（蛋白质/脂肪/碳水）单位为克/每100克(毫升)，可空
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS food_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        energy_per_100 DECIMAL(10, 2) NOT NULL DEFAULT 0,
        food_type ENUM('solid', 'liquid') NOT NULL DEFAULT 'solid',
        protein_per_100 DECIMAL(6, 2) DEFAULT NULL,
        fat_per_100 DECIMAL(6, 2) DEFAULT NULL,
        carb_per_100 DECIMAL(6, 2) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 老库缺三大营养素列时自动补列，并按名称回填预置食物的数据
    const [macroCols] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'food_items' AND COLUMN_NAME = 'protein_per_100'",
      [process.env.DB_NAME || 'meal_log']
    );
    if (macroCols.length === 0) {
      await connection.execute(`
        ALTER TABLE food_items
          ADD COLUMN protein_per_100 DECIMAL(6, 2) DEFAULT NULL,
          ADD COLUMN fat_per_100 DECIMAL(6, 2) DEFAULT NULL,
          ADD COLUMN carb_per_100 DECIMAL(6, 2) DEFAULT NULL
      `);
      console.log('Migrated food_items: added macronutrient columns');

      // 回填预置食物的三大营养素
      for (const seed of SEED_FOODS) {
        await connection.execute(
          'UPDATE food_items SET protein_per_100 = ?, fat_per_100 = ?, carb_per_100 = ? WHERE name = ?',
          [seed[3], seed[4], seed[5], seed[0]]
        );
      }
      console.log(`Backfilled macronutrients for ${SEED_FOODS.length} seed foods`);
    }

    // 创建 user_persons 每日营养目标表（一个账号可记录 1-2 人，每人一行，各自的身体信息与目标；热量统一按 kcal 存储）
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_persons (
        user_id INT NOT NULL,
        person_seq TINYINT NOT NULL,
        name VARCHAR(20) DEFAULT NULL,
        gender VARCHAR(10) DEFAULT NULL,
        age INT DEFAULT NULL,
        height_cm DECIMAL(5, 1) DEFAULT NULL,
        weight_kg DECIMAL(5, 1) DEFAULT NULL,
        target_kcal DECIMAL(8, 2) DEFAULT NULL,
        target_carb DECIMAL(7, 2) DEFAULT NULL,
        target_protein DECIMAL(7, 2) DEFAULT NULL,
        target_fat DECIMAL(7, 2) DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, person_seq),
        CONSTRAINT fk_persons_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建 user_profiles 账号设置表（同吃同记的人数：食物分量为总量，每人摄入 = 总量 ÷ people_count；旧版单人目标表迁移为成员 1 后删除）
    const [oldGoalsTable] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_goals'",
      [process.env.DB_NAME || 'meal_log']
    );
    if (oldGoalsTable.length > 0) {
      // 旧的单人目标迁移为成员 1
      await connection.execute(`
        INSERT IGNORE INTO user_persons (user_id, person_seq, gender, age, height_cm, weight_kg, target_kcal, target_carb, target_protein, target_fat)
        SELECT user_id, 1, gender, age, height_cm, weight_kg, target_kcal, target_carb, target_protein, target_fat FROM user_goals
      `);
      await connection.execute('DROP TABLE user_goals');
      console.log('Migrated user_goals into user_persons (as member 1) and dropped old table');
    }
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INT PRIMARY KEY,
        people_count TINYINT NOT NULL DEFAULT 2,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建 goal_history 目标历史快照表：每次保存目标且热量目标发生变化时写入一条生效记录，
    // 过去日期的达标判断用「当时生效」的目标，后续修改目标不会回溯改变历史达标天数
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS goal_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        person_seq TINYINT NOT NULL,
        effective_date DATE NOT NULL,
        target_kcal DECIMAL(8, 2) DEFAULT NULL,
        INDEX idx_history_user (user_id, person_seq, effective_date),
        CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建 weight_logs 体重称重记录表（减重目标链路数据源：每两周称一次、每期减 2%；
    // 同一成员同一天重复提交按更新处理，目标与达标状态由前端按记录链推导，不落库）
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS weight_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        person_seq TINYINT NOT NULL,
        weigh_date DATE NOT NULL,
        weight_kg DECIMAL(5, 1) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_weight_person_date (user_id, person_seq, weigh_date),
        CONSTRAINT fk_weight_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建 calorie_entries 每日卡路里记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS calorie_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        entry_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
        food_id INT NOT NULL,
        portion DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_date (user_id, entry_date),
        CONSTRAINT fk_calorie_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_calorie_food FOREIGN KEY (food_id) REFERENCES food_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 回填目标历史快照：现存目标补录一条，生效日为该账号最早的卡路里记录日，
    // 保证功能上线前已记录的日子仍能按当前目标显示达标状态（从没记录过的账号不补）
    await connection.execute(`
      INSERT INTO goal_history (user_id, person_seq, effective_date, target_kcal)
      SELECT p.user_id, p.person_seq, first_day.min_date, p.target_kcal
      FROM user_persons p
      JOIN (
        SELECT user_id, MIN(entry_date) AS min_date FROM calorie_entries GROUP BY user_id
      ) first_day ON first_day.user_id = p.user_id
      WHERE p.target_kcal IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM goal_history h WHERE h.user_id = p.user_id AND h.person_seq = p.person_seq)
    `);

    // 食物库为空时导入预置常见食物
    const [foodCount] = await connection.execute('SELECT COUNT(*) as count FROM food_items');
    if (Number(foodCount[0].count) === 0) {
      const values = SEED_FOODS.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const params = SEED_FOODS.flat();
      await connection.execute(
        `INSERT IGNORE INTO food_items (name, energy_per_100, food_type, protein_per_100, fat_per_100, carb_per_100) VALUES ${values}`,
        params
      );
      console.log(`Seeded food_items with ${SEED_FOODS.length} common foods`);
    }

    console.log('Database initialized successfully');
    connection.release();
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

module.exports = { pool, initDatabase };
