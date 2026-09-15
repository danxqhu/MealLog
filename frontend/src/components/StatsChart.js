import React, { useState, useEffect } from 'react';
import './StatsChart.css';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { getMonthlyStats, getMonthlyDailyStats, getQuarterlyStats, getQuarterlyWeeklyStats, getYearlyStats, getFirstYear } from '../api';
import YearMonthPicker from './YearMonthPicker';

const StatsChart = ({ currentDate }) => {
  const [statsView, setStatsView] = useState('month'); // month, quarter, year
  const [statsData, setStatsData] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor((currentDate.getMonth()) / 3) + 1);
  const [chartMode, setChartMode] = useState('amount'); // 'amount' | 'count'
  const [firstYear, setFirstYear] = useState(currentDate.getFullYear());

  // 获取最早有记录的年份
  useEffect(() => {
    const loadFirstYear = async () => {
      try {
        const res = await getFirstYear();
        if (res.success && res.data?.firstYear) {
          setFirstYear(res.data.firstYear);
        }
      } catch (err) {
        console.error('Error loading first year:', err);
      }
    };
    loadFirstYear();
  }, []);

  // 生成完整12个月的数据（补齐无数据月份）
  const fullYearData = React.useMemo(() => {
    const monthMap = {};
    (monthlyData || []).forEach(item => {
      monthMap[item.month] = item;
    });
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const existing = monthMap[m];
      return {
        month: m,
        label: `${m}月`,
        monthly_amount: existing ? parseFloat(existing.monthly_amount || 0) : 0,
        monthly_count: existing ? parseInt(existing.monthly_count || 0) : 0,
        delivery_amount: existing ? parseFloat(existing.delivery_amount || 0) : 0,
        delivery_count: existing ? parseInt(existing.delivery_count || 0) : 0,
        dine_out_amount: existing ? parseFloat(existing.dine_out_amount || 0) : 0,
        dine_out_count: existing ? parseInt(existing.dine_out_count || 0) : 0,
      };
    });
  }, [monthlyData]);

  // 生成完整每日数据（补齐当月所有日期）
  const fullMonthData = React.useMemo(() => {
    const dayMap = {};
    (dailyData || []).forEach(item => {
      dayMap[item.day] = item;
    });
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const existing = dayMap[d];
      return {
        day: d,
        label: `${d}`,
        delivery_amount: existing ? parseFloat(existing.delivery_amount || 0) : 0,
        delivery_count: existing ? parseInt(existing.delivery_count || 0) : 0,
        dine_out_amount: existing ? parseFloat(existing.dine_out_amount || 0) : 0,
        dine_out_count: existing ? parseInt(existing.dine_out_count || 0) : 0,
      };
    });
  }, [dailyData, year, month]);

  // 季度周数据（按周日~周六分组）
  const fullQuarterData = React.useMemo(() => {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    const quarterStart = new Date(year, startMonth - 1, 1);
    const quarterEnd = new Date(year, endMonth, 0); // 季度最后一天

    // 构建日期到数据的映射
    const dateMap = {};
    (weeklyData || []).forEach(item => {
      // date 可能是 'YYYY-MM-DD' 字符串
      dateMap[item.date] = item;
    });

    // 按周日~周六分组：从季度第一天开始，每 7 天为一周
    const weeks = [];
    let current = new Date(quarterStart);
    let weekNum = 1;

    while (current <= quarterEnd) {
      let weekDeliveryAmount = 0;
      let weekDeliveryCount = 0;
      let weekDineOutAmount = 0;
      let weekDineOutCount = 0;

      // 这一周最多 7 天（周日到周六）
      for (let d = 0; d < 7 && current <= quarterEnd; d++) {
        const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        const existing = dateMap[dateStr];
        if (existing) {
          weekDeliveryAmount += parseFloat(existing.delivery_amount || 0);
          weekDeliveryCount += parseInt(existing.delivery_count || 0);
          weekDineOutAmount += parseFloat(existing.dine_out_amount || 0);
          weekDineOutCount += parseInt(existing.dine_out_count || 0);
        }
        current.setDate(current.getDate() + 1);
      }

      weeks.push({
        label: `第${weekNum}周`,
        delivery_amount: weekDeliveryAmount,
        delivery_count: weekDeliveryCount,
        dine_out_amount: weekDineOutAmount,
        dine_out_count: weekDineOutCount,
      });
      weekNum++;
    }

    return weeks;
  }, [weeklyData, year, quarter]);

  // 加载统计数据
  useEffect(() => {
    loadStats();
  }, [statsView, year, month, quarter]);

  const loadStats = async () => {
    try {
      let response;
      
      let statsResult = null;
      switch (statsView) {
        case 'month':
          response = await getMonthlyStats(year, month);
          statsResult = response.data;
          // 同时加载每日明细
          const dailyRes = await getMonthlyDailyStats(year, month);
          setDailyData(dailyRes.data || []);
          break;
        
        case 'quarter':
          response = await getQuarterlyStats(year, quarter);
          statsResult = response.data;
          // 同时加载每周明细
          const weeklyRes = await getQuarterlyWeeklyStats(year, quarter);
          setWeeklyData(weeklyRes.data || []);
          break;
        
        case 'year':
          response = await getYearlyStats(year);
          statsResult = response.data.summary;
          setMonthlyData(response.data.monthly || []);
          break;
        
        default:
          break;
      }
      setStatsData(statsResult);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // 切换视图
  const handleViewChange = (view) => {
    setStatsView(view);
  };

  return (
    <div className="stats-container">
      <div className="stats-header">
        <h2>数据统计</h2>
        <div className="view-switcher">
          <button
            className={statsView === 'month' ? 'active' : ''}
            onClick={() => handleViewChange('month')}
          >
            月度
          </button>
          <button
            className={statsView === 'quarter' ? 'active' : ''}
            onClick={() => handleViewChange('quarter')}
          >
            季度
          </button>
          <button
            className={statsView === 'year' ? 'active' : ''}
            onClick={() => handleViewChange('year')}
          >
            年度
          </button>
        </div>
      </div>

      <div className="stats-controls">
        {statsView === 'month' && (
          <YearMonthPicker
            mode="month"
            year={year}
            month={month}
            firstYear={firstYear}
            onYearChange={setYear}
            onMonthChange={setMonth}
          />
        )}

        {statsView === 'quarter' && (
          <YearMonthPicker
            mode="quarter"
            year={year}
            quarter={quarter}
            firstYear={firstYear}
            onYearChange={setYear}
            onQuarterChange={setQuarter}
          />
        )}

        {statsView === 'year' && (
          <YearMonthPicker
            mode="year"
            year={year}
            firstYear={firstYear}
            onYearChange={setYear}
          />
        )}
      </div>

      {/* 统计卡片 */}
      {statsData && (
        <div className="stats-cards">
          <div className="stat-card total-amount">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <div className="stat-label">总支出</div>
              <div className="stat-value">¥{parseFloat(statsData.total_amount || 0).toFixed(2)}</div>
            </div>
          </div>

          <div className="stat-card meal-count">
            <div className="stat-icon">🍽️</div>
            <div className="stat-info">
              <div className="stat-label">用餐次数</div>
              <div className="stat-value">{statsData.meal_count || 0}</div>
            </div>
          </div>

          <div className="stat-card active-days">
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <div className="stat-label">活跃天数</div>
              <div className="stat-value">{statsData.active_days || 0}天</div>
            </div>
          </div>

          <div className="stat-card average">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-label">平均每次</div>
              <div className="stat-value">
                ¥{statsData.meal_count > 0 
                  ? (parseFloat(statsData.total_amount || 0) / statsData.meal_count).toFixed(2)
                  : '0.00'
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 用餐类型分布 */}
      {statsData && statsData.dining_breakdown && (
        <div className="dining-breakdown">
          <div className="dining-breakdown-title">用餐类型分布</div>
          <div className="dining-breakdown-cards">
            <div className="dining-card delivery-card">
              <div className="dining-card-header">
                <span className="dining-card-icon">🛵</span>
                <span className="dining-card-label">外卖</span>
              </div>
              <div className="dining-card-amount">¥{parseFloat(statsData.dining_breakdown.delivery?.amount || 0).toFixed(2)}</div>
              <div className="dining-card-count">{statsData.dining_breakdown.delivery?.count || 0} 次</div>
            </div>
            <div className="dining-card dine-out-card">
              <div className="dining-card-header">
                <span className="dining-card-icon">🍜</span>
                <span className="dining-card-label">外出就餐</span>
              </div>
              <div className="dining-card-amount">¥{parseFloat(statsData.dining_breakdown.dine_out?.amount || 0).toFixed(2)}</div>
              <div className="dining-card-count">{statsData.dining_breakdown.dine_out?.count || 0} 次</div>
            </div>
          </div>
        </div>
      )}

      {/* 月度每日趋势图 */}
      {statsView === 'month' && (
        <div className="chart-container">
          <div className="chart-title-row">
            <h3>每日支出趋势</h3>
            <div className="chart-mode-switcher">
              <button
                className={chartMode === 'amount' ? 'active amount-active' : ''}
                onClick={() => setChartMode('amount')}
              >
                <span className="mode-dot" style={{ background: '#667eea' }}></span>
                支出金额
              </button>
              <button
                className={chartMode === 'count' ? 'active count-active' : ''}
                onClick={() => setChartMode('count')}
              >
                <span className="mode-dot" style={{ background: '#764ba2' }}></span>
                用餐次数
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={fullMonthData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#666' }}
                axisLine={{ stroke: '#ccc' }}
                tickLine={{ stroke: '#ccc' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#666' }}
                axisLine={{ stroke: '#ccc' }}
                tickLine={{ stroke: '#ccc' }}
                tickFormatter={chartMode === 'amount' ? (v) => `¥${v}` : (v) => `${v}次`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="chart-tooltip">
                      <div className="tooltip-label">{month}月{label}日</div>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="tooltip-row" style={{ color: entry.color }}>
                          <span>{entry.name}</span>
                          <span className="tooltip-value">
                            {chartMode === 'amount' ? `¥${parseFloat(entry.value).toFixed(2)}` : `${entry.value}次`}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey={chartMode === 'amount' ? 'delivery_amount' : 'delivery_count'}
                stroke="#e65100"
                strokeWidth={2}
                dot={{ r: 3, fill: '#e65100', stroke: '#fff', strokeWidth: 1 }}
                activeDot={{ r: 5, fill: '#e65100' }}
                name="外卖"
              />
              <Line
                type="monotone"
                dataKey={chartMode === 'amount' ? 'dine_out_amount' : 'dine_out_count'}
                stroke="#2e7d32"
                strokeWidth={2}
                dot={{ r: 3, fill: '#2e7d32', stroke: '#fff', strokeWidth: 1 }}
                activeDot={{ r: 5, fill: '#2e7d32' }}
                name="外出就餐"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 季度每周趋势图 */}
      {statsView === 'quarter' && (
        <div className="chart-container">
          <div className="chart-title-row">
            <h3>每周支出趋势</h3>
            <div className="chart-mode-switcher">
              <button
                className={chartMode === 'amount' ? 'active amount-active' : ''}
                onClick={() => setChartMode('amount')}
              >
                <span className="mode-dot" style={{ background: '#667eea' }}></span>
                支出金额
              </button>
              <button
                className={chartMode === 'count' ? 'active count-active' : ''}
                onClick={() => setChartMode('count')}
              >
                <span className="mode-dot" style={{ background: '#764ba2' }}></span>
                用餐次数
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={fullQuarterData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#666' }}
                axisLine={{ stroke: '#ccc' }}
                tickLine={{ stroke: '#ccc' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#666' }}
                axisLine={{ stroke: '#ccc' }}
                tickLine={{ stroke: '#ccc' }}
                tickFormatter={chartMode === 'amount' ? (v) => `¥${v}` : (v) => `${v}次`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="chart-tooltip">
                      <div className="tooltip-label">周 {label}</div>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="tooltip-row" style={{ color: entry.color }}>
                          <span>{entry.name}</span>
                          <span className="tooltip-value">
                            {chartMode === 'amount' ? `¥${parseFloat(entry.value).toFixed(2)}` : `${entry.value}次`}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey={chartMode === 'amount' ? 'delivery_amount' : 'delivery_count'}
                stroke="#e65100"
                strokeWidth={2}
                dot={{ r: 4, fill: '#e65100', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#e65100' }}
                name="外卖"
              />
              <Line
                type="monotone"
                dataKey={chartMode === 'amount' ? 'dine_out_amount' : 'dine_out_count'}
                stroke="#2e7d32"
                strokeWidth={2}
                dot={{ r: 4, fill: '#2e7d32', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#2e7d32' }}
                name="外出就餐"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 年度月度图表 */}
      {statsView === 'year' && (
        <div className="chart-container">
          <div className="chart-title-row">
            <h3>各月支出趋势</h3>
            <div className="chart-mode-switcher">
              <button
                className={chartMode === 'amount' ? 'active amount-active' : ''}
                onClick={() => setChartMode('amount')}
              >
                <span className="mode-dot" style={{ background: '#667eea' }}></span>
                支出金额
              </button>
              <button
                className={chartMode === 'count' ? 'active count-active' : ''}
                onClick={() => setChartMode('count')}
              >
                <span className="mode-dot" style={{ background: '#764ba2' }}></span>
                用餐次数
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={fullYearData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 13, fill: '#666' }}
                axisLine={{ stroke: '#ccc' }}
                tickLine={{ stroke: '#ccc' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#666' }}
                axisLine={{ stroke: '#ccc' }}
                tickLine={{ stroke: '#ccc' }}
                tickFormatter={chartMode === 'amount' ? (v) => `¥${v}` : (v) => `${v}次`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="chart-tooltip">
                      <div className="tooltip-label">{label}</div>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="tooltip-row" style={{ color: entry.color }}>
                          <span>{entry.name}</span>
                          <span className="tooltip-value">
                            {chartMode === 'amount' ? `¥${parseFloat(entry.value).toFixed(2)}` : `${entry.value}次`}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey={chartMode === 'amount' ? 'delivery_amount' : 'delivery_count'}
                stroke="#e65100"
                strokeWidth={2}
                dot={{ r: 4, fill: '#e65100', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#e65100' }}
                name="外卖"
              />
              <Line
                type="monotone"
                dataKey={chartMode === 'amount' ? 'dine_out_amount' : 'dine_out_count'}
                stroke="#2e7d32"
                strokeWidth={2}
                dot={{ r: 4, fill: '#2e7d32', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#2e7d32' }}
                name="外出就餐"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 无数据提示 */}
      {!statsData && (
        <div className="no-data">
          <p>暂无统计数据</p>
        </div>
      )}
    </div>
  );
};

export default StatsChart;
