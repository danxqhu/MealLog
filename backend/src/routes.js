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

module.exports = router;
