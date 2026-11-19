const express = require('express');
const router = express.Router();
const { pool } = require('./database');
const { verifyToken } = require('./auth');

// 所有路由需要认证
router.use(verifyToken);

// 获取日期范围内的餐饮记录（用于日历显示，必须在 /meals/:date 之前定义）
router.get('/meals/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const [meals] = await pool.execute(
      'SELECT * FROM meals WHERE user_id = ? AND meal_date BETWEEN ? AND ? ORDER BY meal_date ASC',
      [req.userId, startDate, endDate]
    );

    const parsed = meals.map(m => ({ ...m, amount: parseFloat(m.amount) }));
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error fetching meal range:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取所有历史店名（去重，按使用次数降序）
router.get('/restaurants', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT restaurant_name, COUNT(*) as count FROM meals WHERE user_id = ? GROUP BY restaurant_name ORDER BY count DESC, restaurant_name ASC',
      [req.userId]
    );
    res.json({ success: true, data: rows.map(r => r.restaurant_name) });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取指定日期的餐饮记录
router.get('/meals/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const [meals] = await pool.execute(
      'SELECT * FROM meals WHERE user_id = ? AND meal_date = ? ORDER BY created_at DESC',
      [req.userId, date]
    );
    const parsed = meals.map(m => ({ ...m, amount: parseFloat(m.amount) }));
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 添加餐饮记录
router.post('/meals', async (req, res) => {
  try {
    const { meal_date, restaurant_name, amount, notes, dining_type } = req.body;

    if (!meal_date || !restaurant_name || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (parseFloat(amount) < 0) {
      return res.status(400).json({ success: false, message: '金额不能为负数' });
    }

    if (parseFloat(amount) > 10000) {
      return res.status(400).json({ success: false, message: '金额不能大于 10000 元' });
    }

    const validDiningType = dining_type === 'delivery' || dining_type === 'dine_out' ? dining_type : 'dine_out';

    const [result] = await pool.execute(
      'INSERT INTO meals (user_id, meal_date, restaurant_name, amount, notes, dining_type) VALUES (?, ?, ?, ?, ?, ?)',
      [req.userId, meal_date, restaurant_name, parseFloat(amount), notes || null, validDiningType]
    );

    res.status(201).json({
      success: true,
      message: 'Meal recorded successfully',
      data: { id: result.insertId, meal_date, restaurant_name, amount: parseFloat(amount), notes: notes || null, dining_type: validDiningType }
    });
  } catch (error) {
    console.error('Error adding meal:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 更新餐饮记录
router.put('/meals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurant_name, amount, notes, dining_type } = req.body;

    if (!restaurant_name || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (parseFloat(amount) < 0) {
      return res.status(400).json({ success: false, message: '金额不能为负数' });
    }

    if (parseFloat(amount) > 10000) {
      return res.status(400).json({ success: false, message: '金额不能大于 10000 元' });
    }

    const validDiningType = dining_type === 'delivery' || dining_type === 'dine_out' ? dining_type : 'dine_out';

    await pool.execute(
      'UPDATE meals SET restaurant_name = ?, amount = ?, notes = ?, dining_type = ? WHERE id = ? AND user_id = ?',
      [restaurant_name, parseFloat(amount), notes || null, validDiningType, id, req.userId]
    );

    res.json({ success: true, message: 'Meal updated successfully' });
  } catch (error) {
    console.error('Error updating meal:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 删除餐饮记录
router.delete('/meals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM meals WHERE id = ? AND user_id = ?', [id, req.userId]);
    res.json({ success: true, message: 'Meal deleted successfully' });
  } catch (error) {
    console.error('Error deleting meal:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取统计数据进行图表展示
router.get('/stats/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'Year and month are required' });
    }

    const [stats] = await pool.execute(`
      SELECT SUM(amount) as total_amount, COUNT(*) as meal_count, COUNT(DISTINCT meal_date) as active_days
      FROM meals WHERE user_id = ? AND YEAR(meal_date) = ? AND MONTH(meal_date) = ?
    `, [req.userId, parseInt(year), parseInt(month)]);

    const [diningBreakdown] = await pool.execute(`
      SELECT dining_type, SUM(amount) as total_amount, COUNT(*) as meal_count
      FROM meals WHERE user_id = ? AND YEAR(meal_date) = ? AND MONTH(meal_date) = ?
      GROUP BY dining_type
    `, [req.userId, parseInt(year), parseInt(month)]);

    const breakdown = { delivery: { amount: 0, count: 0 }, dine_out: { amount: 0, count: 0 } };
    diningBreakdown.forEach(row => {
      if (breakdown[row.dining_type]) {
        breakdown[row.dining_type] = { amount: parseFloat(row.total_amount || 0), count: parseInt(row.meal_count || 0) };
      }
    });

    res.json({ success: true, data: { ...stats[0], dining_breakdown: breakdown } });
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取月度每日明细
router.get('/stats/monthly/daily', async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'Year and month are required' });
    }

    const [dailyDetails] = await pool.execute(`
      SELECT DAY(meal_date) as day, dining_type,
        SUM(amount) as day_amount, COUNT(*) as day_count
      FROM meals WHERE user_id = ? AND YEAR(meal_date) = ? AND MONTH(meal_date) = ?
      GROUP BY DAY(meal_date), dining_type ORDER BY day
    `, [req.userId, parseInt(year), parseInt(month)]);

    const dayMap = {};
    dailyDetails.forEach(item => {
      const d = item.day;
      if (!dayMap[d]) {
        dayMap[d] = { day: d, delivery_amount: 0, delivery_count: 0, dine_out_amount: 0, dine_out_count: 0 };
      }
      if (item.dining_type === 'delivery') {
        dayMap[d].delivery_amount = parseFloat(item.day_amount || 0);
        dayMap[d].delivery_count = parseInt(item.day_count || 0);
      } else {
        dayMap[d].dine_out_amount = parseFloat(item.day_amount || 0);
        dayMap[d].dine_out_count = parseInt(item.day_count || 0);
      }
    });

    res.json({ success: true, data: Object.values(dayMap) });
  } catch (error) {
    console.error('Error fetching monthly daily stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取季度统计数据
router.get('/stats/quarterly', async (req, res) => {
  try {
    const { year, quarter } = req.query;
    if (!year || !quarter) {
      return res.status(400).json({ success: false, message: 'Year and quarter are required' });
    }

    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;

    const [stats] = await pool.execute(`
      SELECT SUM(amount) as total_amount, COUNT(*) as meal_count, COUNT(DISTINCT meal_date) as active_days
      FROM meals WHERE user_id = ? AND YEAR(meal_date) = ? AND MONTH(meal_date) BETWEEN ? AND ?
    `, [req.userId, parseInt(year), startMonth, endMonth]);

    const [diningBreakdown] = await pool.execute(`
      SELECT dining_type, SUM(amount) as total_amount, COUNT(*) as meal_count
      FROM meals WHERE user_id = ? AND YEAR(meal_date) = ? AND MONTH(meal_date) BETWEEN ? AND ?
      GROUP BY dining_type
    `, [req.userId, parseInt(year), startMonth, endMonth]);

    const breakdown = { delivery: { amount: 0, count: 0 }, dine_out: { amount: 0, count: 0 } };
    diningBreakdown.forEach(row => {
      if (breakdown[row.dining_type]) {
        breakdown[row.dining_type] = { amount: parseFloat(row.total_amount || 0), count: parseInt(row.meal_count || 0) };
      }
    });

    res.json({ success: true, data: { ...stats[0], dining_breakdown: breakdown } });
  } catch (error) {
    console.error('Error fetching quarterly stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取季度每日明细（前端按周日~周六分组计算周）
router.get('/stats/quarterly/weekly', async (req, res) => {
  try {
    const { year, quarter } = req.query;
    if (!year || !quarter) {
      return res.status(400).json({ success: false, message: 'Year and quarter are required' });
    }

    const startMonth = (parseInt(quarter) - 1) * 3 + 1;
    const endMonth = parseInt(quarter) * 3;

    const startDate = `${parseInt(year)}-${String(startMonth).padStart(2, '0')}-01`;
    const endDateObj = new Date(parseInt(year), endMonth, 0);
    const endDate = `${parseInt(year)}-${String(endMonth).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;

    // 返回季度内每日明细
    const [dailyDetails] = await pool.execute(`
      SELECT meal_date, dining_type,
        SUM(amount) as day_amount, COUNT(*) as day_count
      FROM meals WHERE user_id = ? AND meal_date BETWEEN ? AND ?
      GROUP BY meal_date, dining_type ORDER BY meal_date
    `, [req.userId, startDate, endDate]);

    // 按日期聚合
    const dayMap = {};
    dailyDetails.forEach(item => {
      const d = item.meal_date.toString();
      if (!dayMap[d]) {
        dayMap[d] = { date: d, delivery_amount: 0, delivery_count: 0, dine_out_amount: 0, dine_out_count: 0 };
      }
      if (item.dining_type === 'delivery') {
        dayMap[d].delivery_amount = parseFloat(item.day_amount || 0);
        dayMap[d].delivery_count = parseInt(item.day_count || 0);
      } else {
        dayMap[d].dine_out_amount = parseFloat(item.day_amount || 0);
        dayMap[d].dine_out_count = parseInt(item.day_count || 0);
      }
    });

    res.json({ success: true, data: Object.values(dayMap) });
  } catch (error) {
    console.error('Error fetching quarterly weekly stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取年度统计数据
router.get('/stats/yearly', async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ success: false, message: 'Year is required' });
    }

    const [stats] = await pool.execute(`
      SELECT SUM(amount) as total_amount, COUNT(*) as meal_count, COUNT(DISTINCT meal_date) as active_days
      FROM meals WHERE user_id = ? AND YEAR(meal_date) = ?
    `, [req.userId, parseInt(year)]);

    const [diningBreakdown] = await pool.execute(`
      SELECT dining_type, SUM(amount) as total_amount, COUNT(*) as meal_count
      FROM meals WHERE user_id = ? AND YEAR(meal_date) = ?
      GROUP BY dining_type
    `, [req.userId, parseInt(year)]);

    const breakdown = { delivery: { amount: 0, count: 0 }, dine_out: { amount: 0, count: 0 } };
    diningBreakdown.forEach(row => {
      if (breakdown[row.dining_type]) {
        breakdown[row.dining_type] = { amount: parseFloat(row.total_amount || 0), count: parseInt(row.meal_count || 0) };
      }
    });

    const [monthlyDetails] = await pool.execute(`
      SELECT MONTH(meal_date) as month, dining_type,
        SUM(amount) as monthly_amount, COUNT(*) as monthly_count
      FROM meals WHERE user_id = ? AND YEAR(meal_date) = ?
      GROUP BY MONTH(meal_date), dining_type ORDER BY month
    `, [req.userId, parseInt(year)]);

    // 按月聚合，区分外卖和外出就餐
    const monthlyMap = {};
    monthlyDetails.forEach(item => {
      const m = item.month;
      if (!monthlyMap[m]) {
        monthlyMap[m] = { month: m, monthly_amount: 0, monthly_count: 0, delivery_amount: 0, delivery_count: 0, dine_out_amount: 0, dine_out_count: 0 };
      }
      monthlyMap[m].monthly_amount += parseFloat(item.monthly_amount || 0);
      monthlyMap[m].monthly_count += parseInt(item.monthly_count || 0);
      if (item.dining_type === 'delivery') {
        monthlyMap[m].delivery_amount = parseFloat(item.monthly_amount || 0);
        monthlyMap[m].delivery_count = parseInt(item.monthly_count || 0);
      } else {
        monthlyMap[m].dine_out_amount = parseFloat(item.monthly_amount || 0);
        monthlyMap[m].dine_out_count = parseInt(item.monthly_count || 0);
      }
    });

    const monthly = Object.values(monthlyMap);

    res.json({ success: true, data: { summary: { ...stats[0], dining_breakdown: breakdown }, monthly } });
  } catch (error) {
    console.error('Error fetching yearly stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取用户最早有餐饮记录的年份
router.get('/stats/first-year', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT MIN(YEAR(meal_date)) as firstYear FROM meals WHERE user_id = ?',
      [req.userId]
    );
    const firstYear = rows[0]?.firstYear || new Date().getFullYear();
    res.json({ success: true, data: { firstYear } });
  } catch (error) {
    console.error('Error fetching first year:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== 卡路里相关接口 ====================

const KCAL_PER_KJ = 1 / 4.184; // 1 kJ = 0.239 kcal
const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

// 搜索食物库（全局共享），排序：精确匹配 > 当前用户最近使用时间 > 名称字母序；附带当前用户上次记录的分量
router.get('/foods', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const userId = req.userId;
    const foodColumns = 'f.id, f.name, f.energy_per_100, f.food_type, f.protein_per_100, f.fat_per_100, f.carb_per_100';
    const lastPortionSql = `(SELECT c2.portion FROM calorie_entries c2
       WHERE c2.food_id = f.id AND c2.user_id = ?
       ORDER BY c2.created_at DESC, c2.id DESC LIMIT 1) AS last_portion`;
    let rows;
    if (search) {
      [rows] = await pool.execute(
        `SELECT ${foodColumns}, MAX(c.created_at) AS last_used, ${lastPortionSql}
         FROM food_items f
         LEFT JOIN calorie_entries c ON c.food_id = f.id AND c.user_id = ?
         WHERE f.name LIKE ?
         GROUP BY f.id
         ORDER BY (f.name = ?) DESC, last_used DESC, f.name ASC
         LIMIT 30`,
        [userId, userId, `%${search}%`, search]
      );
    } else {
      [rows] = await pool.execute(
        `SELECT ${foodColumns}, MAX(c.created_at) AS last_used, ${lastPortionSql}
         FROM food_items f
         LEFT JOIN calorie_entries c ON c.food_id = f.id AND c.user_id = ?
         GROUP BY f.id
         ORDER BY last_used DESC, f.name ASC
         LIMIT 30`,
        [userId, userId]
      );
    }
    const parseNum = v => (v === null || v === undefined) ? null : parseFloat(v);
    const parsed = rows.map(({ last_used, ...r }) => ({
      ...r,
      energy_per_100: parseNum(r.energy_per_100),
      protein_per_100: parseNum(r.protein_per_100),
      fat_per_100: parseNum(r.fat_per_100),
      carb_per_100: parseNum(r.carb_per_100),
      last_portion: parseNum(r.last_portion)
    }));
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error searching foods:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 添加食物到食物库（支持 kcal/kJ 输入，能量统一换算为 kcal 存储；三大营养素可选，单位克/每100）
router.post('/foods', async (req, res) => {
  try {
    const { name, energy_per_100, unit, food_type, protein_per_100, fat_per_100, carb_per_100 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '食物名称不能为空' });
    }

    if (energy_per_100 === undefined || energy_per_100 === null || energy_per_100 === '') {
      return res.status(400).json({ success: false, message: '请填写每100克/毫升的热量' });
    }

    const validType = food_type === 'liquid' ? 'liquid' : 'solid';
    const validUnit = unit === 'kJ' ? 'kJ' : 'kcal';

    let value = parseFloat(energy_per_100);
    if (isNaN(value) || value < 0) {
      return res.status(400).json({ success: false, message: '热量值不能为负数' });
    }
    if (value > 10000) {
      return res.status(400).json({ success: false, message: '热量值不能大于 10000' });
    }

    // 统一换算为 kcal 存储
    if (validUnit === 'kJ') {
      value = value * KCAL_PER_KJ;
    }

    const foodName = name.trim();

    // 解析必填的三大营养素：未填报错，非空校验范围
    const macroValues = [];
    for (const [label, raw] of [['蛋白质', protein_per_100], ['脂肪', fat_per_100], ['碳水化合物', carb_per_100]]) {
      if (raw === undefined || raw === null || raw === '') {
        return res.status(400).json({ success: false, message: `请填写${label}含量` });
      }
      const num = parseFloat(raw);
      if (isNaN(num) || num < 0 || num > 100) {
        return res.status(400).json({ success: false, message: `${label}需在 0-100 克之间` });
      }
      macroValues.push(num.toFixed(2));
    }

    // 同名食物已存在时直接返回已有记录，避免唯一键冲突；若传了营养素且库里缺失则补全
    const [existing] = await pool.execute(
      'SELECT id, name, energy_per_100, food_type, protein_per_100, fat_per_100, carb_per_100 FROM food_items WHERE name = ?',
      [foodName]
    );
    if (existing.length > 0) {
      const item = existing[0];
      const parseNum = v => (v === null || v === undefined) ? null : parseFloat(v);
      if (macroValues.some(v => v !== null)) {
        await pool.execute(
          `UPDATE food_items SET
            protein_per_100 = COALESCE(protein_per_100, ?),
            fat_per_100 = COALESCE(fat_per_100, ?),
            carb_per_100 = COALESCE(carb_per_100, ?)
           WHERE name = ?`,
          [...macroValues, foodName]
        );
        const [updated] = await pool.execute(
          'SELECT id, name, energy_per_100, food_type, protein_per_100, fat_per_100, carb_per_100 FROM food_items WHERE name = ?',
          [foodName]
        );
        const u = updated[0];
        return res.json({
          success: true,
          message: '食物已存在，直接使用',
          data: { ...u, energy_per_100: parseNum(u.energy_per_100), protein_per_100: parseNum(u.protein_per_100), fat_per_100: parseNum(u.fat_per_100), carb_per_100: parseNum(u.carb_per_100) }
        });
      }
      return res.json({
        success: true,
        message: '食物已存在，直接使用',
        data: { ...item, energy_per_100: parseNum(item.energy_per_100), protein_per_100: parseNum(item.protein_per_100), fat_per_100: parseNum(item.fat_per_100), carb_per_100: parseNum(item.carb_per_100) }
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO food_items (name, energy_per_100, food_type, protein_per_100, fat_per_100, carb_per_100) VALUES (?, ?, ?, ?, ?, ?)',
      [foodName, value.toFixed(2), validType, macroValues[0], macroValues[1], macroValues[2]]
    );

    res.status(201).json({
      success: true,
      message: '食物添加成功',
      data: {
        id: result.insertId,
        name: foodName,
        energy_per_100: value,
        food_type: validType,
        protein_per_100: macroValues[0] === null ? null : parseFloat(macroValues[0]),
        fat_per_100: macroValues[1] === null ? null : parseFloat(macroValues[1]),
        carb_per_100: macroValues[2] === null ? null : parseFloat(macroValues[2])
      }
    });
  } catch (error) {
    console.error('Error adding food:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 编辑食物库（能量/类型/三大营养素，全局生效；名称不可改避免历史记录失联）
router.put('/foods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { energy_per_100, unit, food_type, protein_per_100, fat_per_100, carb_per_100 } = req.body;

    if (energy_per_100 === undefined || energy_per_100 === null || energy_per_100 === '') {
      return res.status(400).json({ success: false, message: '请填写每100克/毫升的热量' });
    }

    const validType = food_type === 'liquid' ? 'liquid' : 'solid';
    const validUnit = unit === 'kJ' ? 'kJ' : 'kcal';

    let value = parseFloat(energy_per_100);
    if (isNaN(value) || value < 0) {
      return res.status(400).json({ success: false, message: '热量值不能为负数' });
    }
    if (value > 10000) {
      return res.status(400).json({ success: false, message: '热量值不能大于 10000' });
    }

    // 统一换算为 kcal 存储
    if (validUnit === 'kJ') {
      value = value * KCAL_PER_KJ;
    }

    const macroValues = [];
    for (const [label, raw] of [['蛋白质', protein_per_100], ['脂肪', fat_per_100], ['碳水化合物', carb_per_100]]) {
      if (raw === undefined || raw === null || raw === '') {
        return res.status(400).json({ success: false, message: `请填写${label}含量` });
      }
      const num = parseFloat(raw);
      if (isNaN(num) || num < 0 || num > 100) {
        return res.status(400).json({ success: false, message: `${label}需在 0-100 克之间` });
      }
      macroValues.push(num.toFixed(2));
    }

    const [result] = await pool.execute(
      'UPDATE food_items SET energy_per_100 = ?, food_type = ?, protein_per_100 = ?, fat_per_100 = ?, carb_per_100 = ? WHERE id = ?',
      [value.toFixed(4), validType, macroValues[0], macroValues[1], macroValues[2], id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '食物不存在' });
    }

    const [updated] = await pool.execute(
      'SELECT id, name, energy_per_100, food_type, protein_per_100, fat_per_100, carb_per_100 FROM food_items WHERE id = ?',
      [id]
    );
    const parseNum = v => (v === null || v === undefined) ? null : parseFloat(v);
    const u = updated[0];
    res.json({
      success: true,
      message: '食物更新成功',
      data: {
        ...u,
        energy_per_100: parseNum(u.energy_per_100),
        protein_per_100: parseNum(u.protein_per_100),
        fat_per_100: parseNum(u.fat_per_100),
        carb_per_100: parseNum(u.carb_per_100)
      }
    });
  } catch (error) {
    console.error('Error updating food:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 删除食物（所有用户引用该食物的卡路里记录由外键 CASCADE 自动删除，日历合计同步减少）
router.delete('/foods/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [foods] = await pool.execute('SELECT id, name FROM food_items WHERE id = ?', [id]);
    if (foods.length === 0) {
      return res.status(404).json({ success: false, message: '食物不存在' });
    }

    // 统计将被连带删除的记录数，用于前端提示
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM calorie_entries WHERE food_id = ?',
      [id]
    );

    await pool.execute('DELETE FROM food_items WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '食物已删除',
      data: { name: foods[0].name, affectedEntries: Number(countRows[0].cnt) }
    });
  } catch (error) {
    console.error('Error deleting food:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== 每日营养目标接口 ====================

// 可选数值字段解析：空 → null，非空校验范围
const parseOptional = (raw, min, max, label) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const num = parseFloat(raw);
  if (isNaN(num) || num < min || num > max) {
    return { error: `${label}需在 ${min}-${max} 之间` };
  }
  return { value: num };
};

// 获取当前账号的目标设置（人数 + 每人的身体信息与目标；未设置过返回默认 people_count=2、空成员）
router.get('/goals', async (req, res) => {
  try {
    const [profiles] = await pool.execute('SELECT people_count FROM user_profiles WHERE user_id = ?', [req.userId]);
    const peopleCount = profiles.length === 0 ? 2 : parseInt(profiles[0].people_count);

    const [rows] = await pool.execute(
      'SELECT * FROM user_persons WHERE user_id = ? AND person_seq <= ? ORDER BY person_seq ASC',
      [req.userId, peopleCount]
    );
    const parseNum = v => (v === null || v === undefined) ? null : parseFloat(v);
    const persons = rows.map(g => ({
      seq: parseInt(g.person_seq),
      name: g.name,
      gender: g.gender,
      age: g.age === null ? null : parseInt(g.age),
      height_cm: parseNum(g.height_cm),
      weight_kg: parseNum(g.weight_kg),
      target_kcal: parseNum(g.target_kcal),
      target_carb: parseNum(g.target_carb),
      target_protein: parseNum(g.target_protein),
      target_fat: parseNum(g.target_fat)
    }));

    res.json({ success: true, data: { people_count: peopleCount, persons } });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 保存账号目标设置（人数 + 每人的身体信息与目标，整体覆盖；热量支持 kcal/kJ 输入统一存 kcal）
router.put('/goals', async (req, res) => {
  try {
    const { people_count, persons } = req.body;

    const peopleCount = parseInt(people_count);
    if (![1, 2].includes(peopleCount)) {
      return res.status(400).json({ success: false, message: '记录人数只能是 1 或 2' });
    }
    if (!Array.isArray(persons) || persons.length > peopleCount) {
      return res.status(400).json({ success: false, message: '成员数量与记录人数不匹配' });
    }
    const unit = req.body.unit === 'kJ' ? 'kJ' : 'kcal';

    // 逐个成员校验并解析
    const parsed = [];
    for (let i = 0; i < peopleCount; i++) {
      const p = persons[i] || {};

      const parsedName = (p.name === undefined || p.name === null || String(p.name).trim() === '')
        ? null : String(p.name).trim().slice(0, 20);
      const parsedGender = ['male', 'female'].includes(p.gender) ? p.gender : null;

      const checks = [
        ['年龄', parseOptional(p.age, 1, 120, '年龄')],
        ['身高', parseOptional(p.height_cm, 50, 250, '身高')],
        ['体重', parseOptional(p.weight_kg, 20, 500, '体重')],
        ['热量目标', parseOptional(p.target_kcal, 1, 20000, '热量目标')],
        ['碳水目标', parseOptional(p.target_carb, 0, 1000, '碳水目标')],
        ['蛋白质目标', parseOptional(p.target_protein, 0, 1000, '蛋白质目标')],
        ['脂肪目标', parseOptional(p.target_fat, 0, 1000, '脂肪目标')],
      ];
      for (const [, r] of checks) {
        if (r.error) return res.status(400).json({ success: false, message: `成员${i + 1}：${r.error}` });
      }

      // 热量统一换算为 kcal 存储
      let kcalValue = checks[3][1].value;
      if (kcalValue !== null && unit === 'kJ') {
        kcalValue = kcalValue * KCAL_PER_KJ;
      }

      const fmt = v => (v === null ? null : Number(v).toFixed(2));
      parsed.push([
        parsedName, parsedGender, checks[0][1].value, fmt(checks[1][1].value), fmt(checks[2][1].value),
        fmt(kcalValue), fmt(checks[4][1].value), fmt(checks[5][1].value), fmt(checks[6][1].value),
      ]);
    }

    // 目标历史快照：热量目标与最近一条快照相比有变化时，以今天为生效日新增一条；
    // 过去日期的达标判断从此不受后续修改影响
    const [todayRows] = await pool.execute('SELECT CURRENT_DATE AS d');
    const effectiveDate = todayRows[0].d;
    for (let i = 0; i < parsed.length; i++) {
      const newKcal = parsed[i][5]; // 换算后的 kcal，可能为 null
      const [latest] = await pool.execute(
        'SELECT target_kcal FROM goal_history WHERE user_id = ? AND person_seq = ? ORDER BY effective_date DESC, id DESC LIMIT 1',
        [req.userId, i + 1]
      );
      const oldKcal = latest.length === 0 ? undefined : (latest[0].target_kcal === null ? null : parseFloat(latest[0].target_kcal));
      const newNum = newKcal === null ? null : parseFloat(newKcal);
      if (latest.length === 0 || (oldKcal === null ? null : Number(oldKcal)) !== newNum) {
        await pool.execute(
          'INSERT INTO goal_history (user_id, person_seq, effective_date, target_kcal) VALUES (?, ?, ?, ?)',
          [req.userId, i + 1, effectiveDate, newKcal]
        );
      }
    }

    // 人数 + 全员目标整体覆盖写入：减少人数时清除多余成员
    await pool.execute(
      `INSERT INTO user_profiles (user_id, people_count) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE people_count = VALUES(people_count)`,
      [req.userId, peopleCount]
    );
    await pool.execute('DELETE FROM user_persons WHERE user_id = ? AND person_seq > ?', [req.userId, peopleCount]);
    for (let i = 0; i < parsed.length; i++) {
      await pool.execute(
        `INSERT INTO user_persons (user_id, person_seq, name, gender, age, height_cm, weight_kg, target_kcal, target_carb, target_protein, target_fat)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), gender = VALUES(gender), age = VALUES(age),
           height_cm = VALUES(height_cm), weight_kg = VALUES(weight_kg),
           target_kcal = VALUES(target_kcal), target_carb = VALUES(target_carb),
           target_protein = VALUES(target_protein), target_fat = VALUES(target_fat)`,
        [req.userId, i + 1, ...parsed[i]]
      );
    }

    res.json({ success: true, message: '目标保存成功' });
  } catch (error) {
    console.error('Error saving goals:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取日期范围内每日总卡路里（用于迷你日历显示，必须在 /calories/:date 之前定义）
router.get('/calories/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const [rows] = await pool.execute(
      `SELECT ce.entry_date, SUM(fi.energy_per_100 * ce.portion / 100) as total_kcal, COUNT(*) as entry_count
       FROM calorie_entries ce
       JOIN food_items fi ON fi.id = ce.food_id
       WHERE ce.user_id = ? AND ce.entry_date BETWEEN ? AND ?
       GROUP BY ce.entry_date ORDER BY ce.entry_date ASC`,
      [req.userId, startDate, endDate]
    );

    const parsed = rows.map(r => ({
      entry_date: r.entry_date,
      total_kcal: Math.round(parseFloat(r.total_kcal || 0)),
      entry_count: parseInt(r.entry_count)
    }));
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error fetching calorie range:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取日期范围内每日的两人合计热量目标（kcal）：每天取「当时生效」的历史快照之和，
// 某成员当天尚无生效快照或没设目标时返回 null（该天不参与达标判断）
router.get('/goals/history', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const [dateRows] = await pool.execute(
      `SELECT DISTINCT ce.entry_date AS d
       FROM calorie_entries ce
       WHERE ce.user_id = ? AND ce.entry_date BETWEEN ? AND ?
       UNION
       SELECT DISTINCT effective_date AS d
       FROM goal_history
       WHERE user_id = ? AND effective_date <= ?
       ORDER BY d`,
      [req.userId, startDate, endDate, req.userId, endDate]
    );

    const result = [];
    for (const row of dateRows) {
      const d = row.d instanceof Date
        ? `${row.d.getFullYear()}-${String(row.d.getMonth() + 1).padStart(2, '0')}-${String(row.d.getDate()).padStart(2, '0')}`
        : String(row.d);
      const [targetRows] = await pool.execute(
        `SELECT s.person_seq, s.target_kcal
         FROM goal_history s
         JOIN (SELECT person_seq, MAX(effective_date) AS eff
               FROM goal_history
               WHERE user_id = ? AND effective_date <= ?
               GROUP BY person_seq) latest
           ON latest.person_seq = s.person_seq AND latest.eff = s.effective_date
         WHERE s.user_id = ?`,
        [req.userId, d, req.userId]
      );
      const bySeq = {};
      targetRows.forEach(r => {
        bySeq[parseInt(r.person_seq)] = r.target_kcal === null ? null : parseFloat(r.target_kcal);
      });
      const [profileRows] = await pool.execute('SELECT people_count FROM user_profiles WHERE user_id = ?', [req.userId]);
      const peopleCount = profileRows.length === 0 ? 2 : parseInt(profileRows[0].people_count);
      let combined = 0;
      let complete = true;
      for (let seq = 1; seq <= peopleCount; seq++) {
        const v = bySeq[seq];
        if (v === null || v === undefined) { complete = false; break; }
        combined += v;
      }
      result.push({ date: d, combined_target_kcal: complete ? Math.round(combined) : null });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching goals history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取指定日期的卡路里记录（含食物信息）
router.get('/calories/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const [rows] = await pool.execute(
      `SELECT ce.id, ce.entry_date, ce.meal_type, ce.portion, ce.food_id,
              fi.name as food_name, fi.energy_per_100, fi.food_type,
              fi.protein_per_100, fi.fat_per_100, fi.carb_per_100
       FROM calorie_entries ce
       JOIN food_items fi ON fi.id = ce.food_id
       WHERE ce.user_id = ? AND ce.entry_date = ?
       ORDER BY FIELD(ce.meal_type, 'breakfast', 'lunch', 'dinner', 'snack'), ce.created_at ASC`,
      [req.userId, date]
    );

    const parseNum = v => (v === null || v === undefined) ? null : parseFloat(v);
    const parsed = rows.map(r => ({
      ...r,
      portion: parseFloat(r.portion),
      energy_per_100: parseFloat(r.energy_per_100),
      protein_per_100: parseNum(r.protein_per_100),
      fat_per_100: parseNum(r.fat_per_100),
      carb_per_100: parseNum(r.carb_per_100),
      kcal: Math.round(parseFloat(r.energy_per_100) * parseFloat(r.portion) / 100)
    }));
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error fetching calorie entries:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 添加卡路里记录
router.post('/calories', async (req, res) => {
  try {
    const { entry_date, meal_type, food_id, portion } = req.body;

    if (!entry_date || !food_id || portion === undefined || portion === null || portion === '') {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    if (!VALID_MEAL_TYPES.includes(meal_type)) {
      return res.status(400).json({ success: false, message: '餐次类型无效' });
    }

    const portionNum = parseFloat(portion);
    if (isNaN(portionNum) || portionNum <= 0) {
      return res.status(400).json({ success: false, message: '分量必须大于 0' });
    }
    if (portionNum > 10000) {
      return res.status(400).json({ success: false, message: '分量不能大于 10000 克/毫升' });
    }

    const [foods] = await pool.execute('SELECT id FROM food_items WHERE id = ?', [food_id]);
    if (foods.length === 0) {
      return res.status(400).json({ success: false, message: '食物不存在' });
    }

    const [result] = await pool.execute(
      'INSERT INTO calorie_entries (user_id, entry_date, meal_type, food_id, portion) VALUES (?, ?, ?, ?, ?)',
      [req.userId, entry_date, meal_type, food_id, portionNum]
    );

    res.status(201).json({
      success: true,
      message: '记录添加成功',
      data: { id: result.insertId, entry_date, meal_type, food_id, portion: portionNum }
    });
  } catch (error) {
    console.error('Error adding calorie entry:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 更新卡路里记录（分量/餐次）
router.put('/calories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { portion, meal_type } = req.body;

    const portionNum = parseFloat(portion);
    if (isNaN(portionNum) || portionNum <= 0) {
      return res.status(400).json({ success: false, message: '分量必须大于 0' });
    }
    if (portionNum > 10000) {
      return res.status(400).json({ success: false, message: '分量不能大于 10000 克/毫升' });
    }

    const validMealType = VALID_MEAL_TYPES.includes(meal_type) ? meal_type : null;
    if (!validMealType) {
      return res.status(400).json({ success: false, message: '餐次类型无效' });
    }

    const [result] = await pool.execute(
      'UPDATE calorie_entries SET portion = ?, meal_type = ? WHERE id = ? AND user_id = ?',
      [portionNum, validMealType, id, req.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    res.json({ success: true, message: '记录更新成功' });
  } catch (error) {
    console.error('Error updating calorie entry:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 删除卡路里记录
router.delete('/calories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM calorie_entries WHERE id = ? AND user_id = ?', [id, req.userId]);
    res.json({ success: true, message: '记录删除成功' });
  } catch (error) {
    console.error('Error deleting calorie entry:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
