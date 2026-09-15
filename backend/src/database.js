const mysql = require('mysql2/promise');

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

    console.log('Database initialized successfully');
    connection.release();
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

module.exports = { pool, initDatabase };
