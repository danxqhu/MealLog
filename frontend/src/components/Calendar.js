import React, { useState, useEffect } from 'react';
import './Calendar.css';
import { getMealsByRange, getCaloriesByRange, getGoalsHistory } from '../api';

const Calendar = ({ currentDate, onDateClick, onRefresh, onMonthChange, refreshKey }) => {
  const [mealDates, setMealDates] = useState({});
  // 卡路里页每日总摄入（kcal）与每日当时生效的两人热量目标之和，用于展示达标/超标
  const [calorieByDate, setCalorieByDate] = useState({});
  const [targetByDate, setTargetByDate] = useState({});

  // 获取当前年月
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 获取月份名称
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  // 获取当月天数
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // 获取当月第一天是星期几
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  // 加载该月的餐饮数据
  useEffect(() => {
    const loadMonthlyMeals = async () => {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`;

      try {
        const response = await getMealsByRange(startDate, endDate);
        if (response.success) {
          // 将数据按日期分组
          const mealsByDate = {};
          response.data.forEach(meal => {
            if (!mealsByDate[meal.meal_date]) {
              mealsByDate[meal.meal_date] = [];
            }
            mealsByDate[meal.meal_date].push(meal);
          });
          setMealDates(mealsByDate);
        }
      } catch (error) {
        console.error('Error loading meals:', error);
      }
    };

    loadMonthlyMeals();
  }, [year, month, currentDate, refreshKey]);

  // 加载当月卡路里摄入 + 目标历史快照，按「当天生效的目标」计算热量达标状态
  useEffect(() => {
    const loadCalorieStatus = async () => {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`;
      try {
        const [caloriesResp, historyResp] = await Promise.all([
          getCaloriesByRange(startDate, endDate),
          getGoalsHistory(startDate, endDate),
        ]);
        if (caloriesResp.success) {
          const totals = {};
          caloriesResp.data.forEach(item => {
            totals[item.entry_date] = Number(item.total_kcal);
          });
          setCalorieByDate(totals);
        }
        if (historyResp.success) {
          const targets = {};
          historyResp.data.forEach(item => {
            targets[item.date] = item.combined_target_kcal;
          });
          setTargetByDate(targets);
        }
      } catch (error) {
        console.error('Error loading calorie status:', error);
      }
    };
    loadCalorieStatus();
  }, [year, month, currentDate, refreshKey]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // 获取今天日期字符串
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 格式化金额显示：完整展示原始金额
  const formatAmount = (amount) => {
    return `¥${parseFloat(amount.toFixed(2))}`;
  };

  // 生成日历网格
  const generateCalendarDays = () => {
    const days = [];
    
    // 添加前导空白
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // 添加日期
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayMeals = mealDates[dateStr];
      const isToday = dateStr === todayStr;
      
      let totalAmount = 0;
      let mealCount = 0;
      
      if (dayMeals) {
        totalAmount = dayMeals.reduce((sum, meal) => sum + Number(meal.amount), 0);
        mealCount = dayMeals.length;
      }

      // 当天有卡路里记录且当天目标已生效时，判断达标状态（用当时的历史目标，修改目标不回溯）
      const dayKcal = calorieByDate[dateStr];
      const dayTarget = targetByDate[dateStr];
      const hasTarget = dayTarget !== null && dayTarget !== undefined;
      const calorieOver = hasTarget && dayKcal !== undefined && dayKcal > dayTarget;

      days.push(
        <div
          key={day}
          className={`calendar-day ${isToday ? 'today' : ''} ${dayMeals ? 'has-meal' : 'no-meal'}`}
          onClick={() => onDateClick(new Date(year, month, day))}
        >
          <div className="day-number">{day}</div>
          {dayKcal !== undefined && hasTarget && (
            <div className={`calorie-status ${calorieOver ? 'over' : 'ok'}`}>
              {calorieOver ? '热量超标' : '热量达标'}
            </div>
          )}
          {dayMeals ? (
            <div className="meal-info">
              <div className="meal-count">{mealCount}餐</div>
              <div className="meal-amount">{formatAmount(totalAmount)}</div>
            </div>
          ) : (
            <div className="meal-info no-eating">
              <div className="no-eating-text">-</div>
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button
          className="nav-button"
          onClick={() => onMonthChange(new Date(year, month - 1, 1))}
        >
          ←
        </button>
        <h2>{year}年 {monthNames[month]}</h2>
        <button
          className="nav-button"
          onClick={() => onMonthChange(new Date(year, month + 1, 1))}
        >
          →
        </button>
      </div>

      <div className="calendar-today-bar">
        <button
          className="today-button"
          onClick={() => onMonthChange(new Date())}
        >
          📍 今天
        </button>
      </div>

      <div className="calendar-weekdays">
        <div>日</div>
        <div>一</div>
        <div>二</div>
        <div>三</div>
        <div>四</div>
        <div>五</div>
        <div>六</div>
      </div>

      <div className="calendar-grid">
        {generateCalendarDays()}
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-color today-legend"></span>
          <span>今天</span>
        </div>
        <div className="legend-item">
          <span className="legend-color has-meal-legend"></span>
          <span>有饮食记录</span>
        </div>
        <div className="legend-item">
          <span className="legend-color no-meal-legend"></span>
          <span>未记录</span>
        </div>
        {Object.values(targetByDate).some(v => v !== null && v !== undefined) && (
          <>
            <div className="legend-item">
              <span className="legend-text-ok">热量达标</span>
            </div>
            <div className="legend-item">
              <span className="legend-text-over">热量超标</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Calendar;
