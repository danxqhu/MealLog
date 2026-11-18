import React, { useState, useEffect, useRef } from 'react';
import './CaloriePage.css';
import {
  searchFoods,
  addFood,
  updateFood,
  deleteFood,
  getCaloriesByDate,
  getCaloriesByRange,
  addCalorieEntry,
  updateCalorieEntry,
  deleteCalorieEntry,
  getGoals,
  updateGoals,
} from '../api';

const KCAL_TO_KJ = 4.184;

const MEAL_TYPES = [
  { key: 'breakfast', label: '早餐', icon: '🥣' },
  { key: 'lunch', label: '中餐', icon: '🍱' },
  { key: 'dinner', label: '晚餐', icon: '🍜' },
  { key: 'snack', label: '加餐', icon: '🍪' },
];

// 格式化日期为 YYYY-MM-DD
const formatDateStr = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// kcal 转换为当前显示单位的数值
const toDisplayValue = (kcal, unit) => {
  const value = unit === 'kJ' ? kcal * KCAL_TO_KJ : kcal;
  return Math.round(value);
};

// 能量显示文本（含单位）
const formatEnergy = (kcal, unit) => `${toDisplayValue(kcal, unit)} ${unit}`;

// 三大营养素摘要文本（克/每100），全部缺失时返回空
const formatMacros = (food) => {
  const parts = [];
  if (food.protein_per_100 !== null && food.protein_per_100 !== undefined) parts.push(`蛋白 ${parseFloat(food.protein_per_100)}g`);
  if (food.fat_per_100 !== null && food.fat_per_100 !== undefined) parts.push(`脂肪 ${parseFloat(food.fat_per_100)}g`);
  if (food.carb_per_100 !== null && food.carb_per_100 !== undefined) parts.push(`碳水 ${parseFloat(food.carb_per_100)}g`);
  return parts.join(' · ');
};

const CaloriePage = ({ currentDate, onMonthChange }) => {
  const [unit, setUnit] = useState(() => localStorage.getItem('calorieUnit') === 'kJ' ? 'kJ' : 'kcal');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState([]);
  const [dayTotals, setDayTotals] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFoodAdmin, setShowFoodAdmin] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goals, setGoals] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const selectedDateStr = formatDateStr(selectedDate);

  const today = new Date();
  const todayStr = formatDateStr(today);

  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  // 切换显示单位并持久化
  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
    localStorage.setItem('calorieUnit', newUnit);
  };

  // 加载当月每日总卡路里（迷你日历用）
  useEffect(() => {
    const loadMonthTotals = async () => {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`;
      try {
        const response = await getCaloriesByRange(startDate, endDate);
        if (response.success) {
          const totals = {};
          response.data.forEach(item => {
            totals[item.entry_date] = item.total_kcal;
          });
          setDayTotals(totals);
        }
      } catch (error) {
        console.error('Error loading calorie totals:', error);
      }
    };
    loadMonthTotals();
  }, [year, month, refreshKey]);

  // 加载选中日期的记录
  useEffect(() => {
    const loadEntries = async () => {
      try {
        const response = await getCaloriesByDate(selectedDateStr);
        if (response.success) {
          setEntries(response.data);
        }
      } catch (error) {
        console.error('Error loading calorie entries:', error);
      }
    };
    loadEntries();
  }, [selectedDateStr, refreshKey]);

  // 加载账号目标设置（人数 + 每人目标，弹窗保存后或刷新时重新拉取）
  useEffect(() => {
    const loadGoals = async () => {
      try {
        const response = await getGoals();
        if (response.success) setGoals(response.data);
      } catch (error) {
        console.error('Error loading goals:', error);
      }
    };
    loadGoals();
  }, [refreshKey, showGoalModal]);

  // 数据变更后刷新
  const refresh = () => setRefreshKey(k => k + 1);

  // 按餐次分组
  const entriesByMeal = {};
  MEAL_TYPES.forEach(m => { entriesByMeal[m.key] = []; });
  entries.forEach(e => {
    if (entriesByMeal[e.meal_type]) {
      entriesByMeal[e.meal_type].push(e);
    }
  });

  const dayTotalKcal = entries.reduce((sum, e) => sum + (e.kcal || 0), 0);

  // 当日三大营养素摄入（克）：每100含量 × 分量 ÷ 100 累加
  const sumMacro = (field) => entries.reduce((sum, e) => {
    const per100 = parseFloat(e[field]);
    return sum + (isNaN(per100) ? 0 : per100 * (parseFloat(e.portion) || 0) / 100);
  }, 0);
  // 账号记录的总热量（分量为两人总量，这里直接累加）
  const dayTotal = {
    kcal: dayTotalKcal,
    carb: sumMacro('carb_per_100'),
    protein: sumMacro('protein_per_100'),
    fat: sumMacro('fat_per_100'),
  };

  // 每人摄入 = 总量 ÷ 记录人数；成员目标按 person_seq 对应
  const peopleCount = goals?.people_count || 2;
  const persons = [1, 2].slice(0, peopleCount).map(seq => goals?.persons?.find(p => p.seq === seq) || null);
  const dayIntake = {
    kcal: dayTotal.kcal / peopleCount,
    carb: dayTotal.carb / peopleCount,
    protein: dayTotal.protein / peopleCount,
    fat: dayTotal.fat / peopleCount,
  };

  // 多人目标汇总：仅当参与记录的成员都设了热量目标才对比，否则不显示避免误导
  const combinedKcalTarget = persons.every(p => p && p.target_kcal !== null && p.target_kcal !== undefined)
    ? persons.reduce((s, p) => s + parseFloat(p.target_kcal), 0)
    : null;
  const combinedOver = combinedKcalTarget !== null && dayTotal.kcal > combinedKcalTarget;

  // ==================== 迷你日历 ====================
  const renderMiniCalendar = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="mini-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const total = dayTotals[dateStr];
      const classes = ['mini-day'];
      if (total) classes.push('has-data');
      if (dateStr === todayStr) classes.push('today');
      if (dateStr === selectedDateStr) classes.push('selected');

      cells.push(
        <div
          key={day}
          className={classes.join(' ')}
          onClick={() => setSelectedDate(new Date(year, month, day))}
        >
          <div className="mini-day-number">{day}</div>
          {total ? (
            <div className="mini-day-kcal">{toDisplayValue(total, unit)}</div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="calorie-calendar">
        <div className="calorie-calendar-header">
          <button className="nav-button" onClick={() => onMonthChange(new Date(year, month - 1, 1))}>←</button>
          <h3>{year}年 {monthNames[month]}</h3>
          <button className="nav-button" onClick={() => onMonthChange(new Date(year, month + 1, 1))}>→</button>
        </div>
        <div className="calorie-calendar-actions">
          <button className="today-button" onClick={() => { onMonthChange(new Date()); setSelectedDate(new Date()); }}>
            📍 今天
          </button>
          <div className="actions-right">
            <button className="goal-button" onClick={() => setShowGoalModal(true)}>
              🎯 目标
            </button>
            <button className="food-admin-button" onClick={() => setShowFoodAdmin(true)}>
              🗂️ 编辑食物库
            </button>
            <div className="unit-toggle">
              <button className={unit === 'kcal' ? 'active' : ''} onClick={() => handleUnitChange('kcal')}><span className="unit-zh">千卡 </span>kcal</button>
              <button className={unit === 'kJ' ? 'active' : ''} onClick={() => handleUnitChange('kJ')}><span className="unit-zh">千焦 </span>kJ</button>
            </div>
          </div>
        </div>
        <div className="calorie-weekdays">
          {['日', '一', '二', '三', '四', '五', '六'].map(w => <div key={w}>{w}</div>)}
        </div>
        <div className="calorie-mini-grid">{cells}</div>
      </div>
    );
  };

  // ==================== 餐次区块 ====================
  const renderMealSection = (meal) => {
    const mealEntries = entriesByMeal[meal.key];
    const mealTotal = mealEntries.reduce((sum, e) => sum + (e.kcal || 0), 0);

    return (
      <div className="meal-section" key={meal.key}>
        <div className="meal-section-header">
          <span className="meal-section-title">{meal.icon} {meal.label}</span>
          <span className="meal-section-total">{mealTotal ? formatEnergy(mealTotal, unit) : '-'}</span>
        </div>

        {mealEntries.length > 0 && (
          <ul className="entry-list">
            {mealEntries.map(entry => (
              <EntryRow key={entry.id} entry={entry} unit={unit} onChanged={refresh} />
            ))}
          </ul>
        )}

        <AddFoodControl
          mealKey={meal.key}
          dateStr={selectedDateStr}
          unit={unit}
          onSaved={refresh}
        />
      </div>
    );
  };

  return (
    <div className="calorie-container">
      {renderMiniCalendar()}

      <div className={`calorie-day-summary ${combinedOver ? 'over' : ''}`}>
        <span className="summary-date">{selectedDateStr}</span>
        <span className="summary-total">
          当日合计：{dayTotalKcal ? formatEnergy(dayTotalKcal, unit) : '暂无记录'}
          {combinedKcalTarget !== null && (
            <span className="summary-target">
              {' '}/ {peopleCount}人目标 {formatEnergy(combinedKcalTarget, unit)}
            </span>
          )}
          {combinedOver && <span className="summary-badge over">⚠️ 超标</span>}
          {!combinedOver && combinedKcalTarget !== null && dayTotalKcal > 0 && (
            <span className="summary-badge ok">✓ 达标</span>
          )}
        </span>
      </div>

      {/* 每个成员一行：摄入 vs 自己的目标，超标标红 */}
      {persons.map((p, idx) => {
        const items = [
          { key: 'kcal', label: '热量', intake: dayIntake.kcal, target: p?.target_kcal, isEnergy: true },
          { key: 'carb', label: '碳水', intake: dayIntake.carb, target: p?.target_carb },
          { key: 'protein', label: '蛋白', intake: dayIntake.protein, target: p?.target_protein },
          { key: 'fat', label: '脂肪', intake: dayIntake.fat, target: p?.target_fat },
        ];
        const hasAnyTarget = items.some(it => it.target !== null && it.target !== undefined);
        return (
          <div className="person-goal-row" key={idx}>
            <span className="person-goal-name">{p?.name || `成员${idx + 1}`}</span>
            {hasAnyTarget ? items.map(it => {
              if (it.target === null || it.target === undefined) {
                return <span className="person-goal-item no-goal" key={it.key}>{it.label}未设</span>;
              }
              const over = it.intake > it.target;
              const text = it.isEnergy
                ? `${toDisplayValue(it.intake, unit)}/${toDisplayValue(it.target, unit)}`
                : `${Math.round(it.intake * 10) / 10}/${Math.round(it.target * 10) / 10}g`;
              return (
                <span className={`person-goal-item ${over ? 'over' : 'ok'}`} key={it.key}>
                  {it.label}{text}{over ? '⚠' : '✓'}
                </span>
              );
            }) : <span className="person-goal-item no-goal">未设目标，点上方「🎯 目标」配置</span>}
          </div>
        );
      })}

      <div className="meal-sections">
        {MEAL_TYPES.map(renderMealSection)}
      </div>

      {showFoodAdmin && (
        <div className="food-admin-overlay" onClick={() => setShowFoodAdmin(false)}>
          <div className="food-admin-modal" onClick={(e) => e.stopPropagation()}>
            <FoodAdminModal unit={unit} onClose={() => setShowFoodAdmin(false)} onChanged={refresh} />
          </div>
        </div>
      )}

      {showGoalModal && (
        <div className="food-admin-overlay" onClick={() => setShowGoalModal(false)}>
          <div className="food-admin-modal" onClick={(e) => e.stopPropagation()}>
            <GoalModal unit={unit} onClose={() => setShowGoalModal(false)} onSaved={refresh} />
          </div>
        </div>
      )}
    </div>
  );
};

// 单条记录行：食物名 + 分量 + 能量，支持修改分量和删除
const EntryRow = ({ entry, unit, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [portion, setPortion] = useState(entry.portion);
  const [error, setError] = useState('');
  const portionUnit = entry.food_type === 'liquid' ? '毫升' : '克';

  const handleSave = async () => {
    const value = parseFloat(portion);
    if (isNaN(value) || value <= 0) {
      setError('分量必须大于 0');
      return;
    }
    try {
      const response = await updateCalorieEntry(entry.id, { portion: value, meal_type: entry.meal_type });
      if (response.success) {
        onChanged();
        setEditing(false);
        setError('');
      } else {
        setError(response.message || '保存失败');
      }
    } catch (err) {
      setError('保存失败，请重试');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`确定删除「${entry.food_name}」这条记录吗？`)) return;
    try {
      await deleteCalorieEntry(entry.id);
      onChanged();
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  if (editing) {
    return (
      <li className="entry-row editing-row">
        <span className="entry-food-name">{entry.food_name}</span>
        <input
          type="number"
          className="portion-input"
          value={portion}
          min="0"
          step="1"
          onChange={(e) => setPortion(e.target.value)}
          autoFocus
        />
        <span className="entry-portion-unit">{portionUnit}</span>
        <button className="icon-button save" onClick={handleSave} title="保存">✓</button>
        <button className="icon-button cancel" onClick={() => { setEditing(false); setPortion(entry.portion); setError(''); }} title="取消">✕</button>
        {error && <span className="entry-error">{error}</span>}
      </li>
    );
  }

  return (
    <li className="entry-row">
      <span className="entry-food-name">{entry.food_name}</span>
      <span className="entry-portion">{parseFloat(entry.portion)}{portionUnit}</span>
      <span className="entry-kcal">{formatEnergy(entry.kcal, unit)}</span>
      <button className="icon-button edit" onClick={() => setEditing(true)} title="修改分量">✏️</button>
      <button className="icon-button delete" onClick={handleDelete} title="删除">🗑️</button>
    </li>
  );
};

// 添加食物：搜索食物库 → 选中填分量；未找到可入库
const AddFoodControl = ({ mealKey, dateStr, unit, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [portion, setPortion] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 新增食物到食物库的表单（默认千焦，因为包装营养表大多标 kJ；三大营养素必填）
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFoodName, setNewFoodName] = useState('');
  const [newEnergy, setNewEnergy] = useState('');
  const [newEnergyUnit, setNewEnergyUnit] = useState('kJ');
  const [newFoodType, setNewFoodType] = useState('solid');
  const [newProtein, setNewProtein] = useState('');
  const [newFat, setNewFat] = useState('');
  const [newCarb, setNewCarb] = useState('');

  const searchTimerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // 搜索防抖
  useEffect(() => {
    if (!open) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const response = await searchFoods(searchText.trim());
        if (response.success) setResults(response.data);
      } catch (err) {
        console.error('Error searching foods:', err);
      }
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchText, open]);

  const reset = () => {
    setOpen(false);
    setSearchText('');
    setResults([]);
    setSelectedFood(null);
    setPortion('');
    setError('');
    setShowCreateForm(false);
    setNewFoodName('');
    setNewEnergy('');
    setNewEnergyUnit('kJ');
    setNewFoodType('solid');
    setNewProtein('');
    setNewFat('');
    setNewCarb('');
  };

  // 打开新建食物表单，名称自动带入搜索词供修改（支持同名不同品种，如「樱桃（车厘子）」）
  const openCreateForm = () => {
    setNewFoodName(searchText.trim());
    setShowCreateForm(true);
    setSelectedFood(null);
    setError('');
  };

  const handleCreateFood = async () => {
    if (!newFoodName.trim()) {
      setError('请填写食物名称');
      return;
    }
    const value = parseFloat(newEnergy);
    if (isNaN(value) || value < 0) {
      setError('请填写有效的热量值');
      return;
    }
    for (const [label, raw] of [['蛋白质', newProtein], ['脂肪', newFat], ['碳水', newCarb]]) {
      if (raw === '') {
        setError(`请填写${label}含量`);
        return;
      }
      const num = parseFloat(raw);
      if (isNaN(num) || num < 0 || num > 100) {
        setError(`${label}需在 0-100 克之间`);
        return;
      }
    }
    try {
      const response = await addFood({
        name: newFoodName.trim(),
        energy_per_100: value,
        unit: newEnergyUnit,
        food_type: newFoodType,
        protein_per_100: parseFloat(newProtein),
        fat_per_100: parseFloat(newFat),
        carb_per_100: parseFloat(newCarb),
      });
      if (response.success) {
        setSelectedFood(response.data);
        setShowCreateForm(false);
        setError('');
      } else {
        setError(response.message || '添加食物失败');
      }
    } catch (err) {
      setError('添加食物失败，请重试');
    }
  };

  const handleSubmit = async () => {
    const value = parseFloat(portion);
    if (!selectedFood) {
      setError('请先选择食物');
      return;
    }
    if (isNaN(value) || value <= 0) {
      setError('分量必须大于 0');
      return;
    }
    setSubmitting(true);
    try {
      const response = await addCalorieEntry({
        entry_date: dateStr,
        meal_type: mealKey,
        food_id: selectedFood.id,
        portion: value,
      });
      if (response.success) {
        onSaved();
        reset();
      } else {
        setError(response.message || '保存失败');
      }
    } catch (err) {
      setError('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button className="add-food-button" onClick={() => setOpen(true)}>＋ 添加食物</button>
    );
  }

  const previewKcal = selectedFood && parseFloat(portion) > 0
    ? parseFloat(selectedFood.energy_per_100) * parseFloat(portion) / 100
    : 0;

  const noResults = searchText.trim() && results.length === 0;

  return (
    <div className="add-food-panel">
      <input
        ref={inputRef}
        type="text"
        className="food-search-input"
        placeholder="搜索食物名称…"
        value={searchText}
        onChange={(e) => { setSearchText(e.target.value); setSelectedFood(null); setShowCreateForm(false); }}
      />

      {!selectedFood && !showCreateForm && (
        <ul className="food-results">
          {results.map(food => (
            <li key={food.id} onClick={() => { setSelectedFood(food); setError(''); }}>
              <div className="food-result-info">
                <span className="food-result-name">{food.name}</span>
                {formatMacros(food) && <span className="food-result-macros">{formatMacros(food)}</span>}
              </div>
              <span className="food-result-energy">
                {formatEnergy(parseFloat(food.energy_per_100), unit)}/100{food.food_type === 'liquid' ? '毫升' : '克'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {noResults && !showCreateForm && (
        <div className="food-not-found-hint">食物库中没有「{searchText.trim()}」，可直接添加为新食物</div>
      )}

      {!showCreateForm && !selectedFood && (
        <button className="add-new-food-link" onClick={openCreateForm}>
          ➕ 添加新食物到食物库
        </button>
      )}

      {showCreateForm && (
        <div className="create-food-form">
          <div className="create-food-row">
            <span className="create-food-label required">食物名称</span>
            <input
              type="text"
              className="food-name-input"
              value={newFoodName}
              placeholder="如：樱桃（车厘子）"
              onChange={(e) => setNewFoodName(e.target.value)}
            />
          </div>
          <div className="create-food-row">
            <span className="create-food-label">热量值</span>
            <input
              type="number"
              value={newEnergy}
              min="0"
              step="0.1"
              placeholder="0"
              onChange={(e) => setNewEnergy(e.target.value)}
            />
            <span className="create-food-per">每100{newFoodType === 'liquid' ? '毫升' : '克'}</span>
          </div>
          <div className="create-food-row">
            <span className="create-food-label">热量单位</span>
            <div className="segment-toggle">
              <button className={newEnergyUnit === 'kcal' ? 'active' : ''} onClick={() => setNewEnergyUnit('kcal')}>千卡 kcal</button>
              <button className={newEnergyUnit === 'kJ' ? 'active' : ''} onClick={() => setNewEnergyUnit('kJ')}>千焦 kJ</button>
            </div>
          </div>
          <div className="create-food-row">
            <span className="create-food-label required">蛋白质</span>
            <input
              type="number"
              value={newProtein}
              min="0"
              max="100"
              step="0.1"
              placeholder="必填"
              onChange={(e) => setNewProtein(e.target.value)}
            />
            <span className="create-food-per">每100{newFoodType === 'liquid' ? '毫升' : '克'}</span>
          </div>
          <div className="create-food-row">
            <span className="create-food-label required">脂肪</span>
            <input
              type="number"
              value={newFat}
              min="0"
              max="100"
              step="0.1"
              placeholder="必填"
              onChange={(e) => setNewFat(e.target.value)}
            />
            <span className="create-food-per">每100{newFoodType === 'liquid' ? '毫升' : '克'}</span>
          </div>
          <div className="create-food-row">
            <span className="create-food-label required">碳水化合物</span>
            <input
              type="number"
              value={newCarb}
              min="0"
              max="100"
              step="0.1"
              placeholder="必填"
              onChange={(e) => setNewCarb(e.target.value)}
            />
            <span className="create-food-per">每100{newFoodType === 'liquid' ? '毫升' : '克'}</span>
          </div>
          <div className="create-food-row">
            <span className="create-food-label">食物类型</span>
            <div className="segment-toggle">
              <button className={newFoodType === 'solid' ? 'active' : ''} onClick={() => setNewFoodType('solid')}>固体（克）</button>
              <button className={newFoodType === 'liquid' ? 'active' : ''} onClick={() => setNewFoodType('liquid')}>液体（毫升）</button>
            </div>
          </div>
          <div className="create-food-actions">
            <button className="btn-primary" onClick={handleCreateFood}>保存食物库</button>
            <button className="btn-secondary" onClick={() => setShowCreateForm(false)}>返回搜索结果</button>
          </div>
        </div>
      )}

      {selectedFood && (
        <div className="portion-row">
          <span className="selected-food-name">
            {selectedFood.name}
            <span className="selected-food-energy">（{formatEnergy(parseFloat(selectedFood.energy_per_100), unit)}/100{selectedFood.food_type === 'liquid' ? '毫升' : '克'}）</span>
            {formatMacros(selectedFood) && (
              <span className="selected-food-macros">{formatMacros(selectedFood)} 每100{selectedFood.food_type === 'liquid' ? '毫升' : '克'}</span>
            )}
          </span>
          <input
            type="number"
            value={portion}
            min="0"
            step="1"
            className="portion-input"
            placeholder={`分量（${selectedFood.food_type === 'liquid' ? '毫升' : '克'}）`}
            onChange={(e) => setPortion(e.target.value)}
          />
          <span className="portion-preview">
            {previewKcal > 0 ? `≈ ${formatEnergy(previewKcal, unit)}` : `请输入${selectedFood.food_type === 'liquid' ? '毫升' : '克'}数`}
          </span>
        </div>
      )}

      {error && <div className="entry-error">{error}</div>}

      <div className="add-food-actions">
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!selectedFood || submitting}
        >
          {submitting ? '保存中…' : '保存记录'}
        </button>
        <button className="btn-secondary" onClick={reset}>取消</button>
      </div>
    </div>
  );
};

// 食物库编辑弹窗：搜索食物 → 选中 → 修改热量与三大营养素
const FoodAdminModal = ({ unit, onClose, onChanged }) => {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [form, setForm] = useState(null); // 当前编辑中的食物
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const searchTimerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // 搜索防抖
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const response = await searchFoods(searchText.trim());
        if (response.success) setResults(response.data);
      } catch (err) {
        console.error('Error searching foods:', err);
      }
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchText]);

  const macroText = v => (v === null || v === undefined) ? '' : String(parseFloat(v));

  const handleSelect = (food) => {
    setError('');
    setNotice('');
    setForm({
      id: food.id,
      name: food.name,
      energy: String(parseFloat(food.energy_per_100)), // 库里存的是 kcal
      energyUnit: 'kcal',
      foodType: food.food_type,
      protein: macroText(food.protein_per_100),
      fat: macroText(food.fat_per_100),
      carb: macroText(food.carb_per_100),
    });
  };

  // 切换热量单位：换算当前输入值，保持实际能量不变
  const handleUnitSwitch = (newUnit) => {
    if (!form || newUnit === form.energyUnit) return;
    const v = parseFloat(form.energy);
    if (isNaN(v)) {
      setForm(f => ({ ...f, energyUnit: newUnit }));
      return;
    }
    const kcal = form.energyUnit === 'kJ' ? v / KCAL_TO_KJ : v;
    const next = newUnit === 'kJ' ? kcal * KCAL_TO_KJ : kcal;
    setForm(f => ({ ...f, energyUnit: newUnit, energy: String(Math.round(next * 100) / 100) }));
  };

  const handleSave = async () => {
    if (!form) return;
    const energy = parseFloat(form.energy);
    if (isNaN(energy) || energy < 0 || energy > 10000) {
      setError('热量值需在 0-10000 之间');
      return;
    }
    for (const [label, raw] of [['蛋白质', form.protein], ['脂肪', form.fat], ['碳水', form.carb]]) {
      if (raw === '') {
        setError(`请填写${label}含量`);
        return;
      }
      const num = parseFloat(raw);
      if (isNaN(num) || num < 0 || num > 100) {
        setError(`${label}需在 0-100 克之间`);
        return;
      }
    }
    setSaving(true);
    try {
      const response = await updateFood(form.id, {
        energy_per_100: energy,
        unit: form.energyUnit,
        food_type: form.foodType,
        protein_per_100: parseFloat(form.protein),
        fat_per_100: parseFloat(form.fat),
        carb_per_100: parseFloat(form.carb),
      });
      if (response.success) {
        setForm(null);
        setError('');
        onChanged();
        // 刷新列表显示最新数据
        const refreshed = await searchFoods(searchText.trim());
        if (refreshed.success) setResults(refreshed.data);
      } else {
        setError(response.message || '保存失败');
      }
    } catch (err) {
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 删除食物：二次确认后执行，引用该食物的历史记录由后端级联删除
  const handleDelete = async () => {
    if (!form) return;
    const ok = window.confirm(
      `确定从食物库删除「${form.name}」吗？\n\n所有用户日历中引用该食物的卡路里记录会一并删除，每日合计同步减少，且不可恢复。`
    );
    if (!ok) return;
    setSaving(true);
    try {
      const response = await deleteFood(form.id);
      if (response.success) {
        setForm(null);
        setError('');
        setNotice(`已删除「${response.data.name}」，同时清除了 ${response.data.affectedEntries} 条相关记录`);
        onChanged();
        const refreshed = await searchFoods(searchText.trim());
        if (refreshed.success) setResults(refreshed.data);
      } else {
        setError(response.message || '删除失败');
      }
    } catch (err) {
      setError('删除失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="food-admin-body">
      <div className="food-admin-header">
        <h3>🗂️ 编辑食物库</h3>
        <button className="modal-close" onClick={onClose} title="关闭">✕</button>
      </div>

      <div className="admin-note">
        ⚠️ 食物库全局共享，编辑会同步变化所有历史记录中该食物的营养计算
      </div>

      {notice && <div className="admin-success-notice">{notice}</div>}

      <input
        ref={inputRef}
        type="text"
        className="food-search-input"
        placeholder="搜索食物名称…"
        value={searchText}
        onChange={(e) => { setSearchText(e.target.value); setForm(null); }}
      />

      {!form && results.length > 0 && (
        <ul className="food-results">
          {results.map(food => (
            <li key={food.id} onClick={() => handleSelect(food)}>
              <div className="food-result-info">
                <span className="food-result-name">{food.name}</span>
                {formatMacros(food) && <span className="food-result-macros">{formatMacros(food)}</span>}
              </div>
              <span className="food-result-energy">
                {formatEnergy(parseFloat(food.energy_per_100), unit)}/100{food.food_type === 'liquid' ? '毫升' : '克'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="create-food-form">
          <div className="create-food-row">
            <span className="create-food-label">食物名称</span>
            <span className="create-food-name">{form.name}</span>
          </div>
          <div className="create-food-row">
            <span className="create-food-label required">热量值</span>
            <input
              type="number"
              value={form.energy}
              min="0"
              step="0.1"
              onChange={(e) => setForm(f => ({ ...f, energy: e.target.value }))}
            />
            <span className="create-food-per">每100{form.foodType === 'liquid' ? '毫升' : '克'}</span>
            <div className="segment-toggle">
              <button className={form.energyUnit === 'kcal' ? 'active' : ''} onClick={() => handleUnitSwitch('kcal')}>千卡 kcal</button>
              <button className={form.energyUnit === 'kJ' ? 'active' : ''} onClick={() => handleUnitSwitch('kJ')}>千焦 kJ</button>
            </div>
          </div>
          <div className="create-food-row">
            <span className="create-food-label">食物类型</span>
            <div className="segment-toggle">
              <button className={form.foodType === 'solid' ? 'active' : ''} onClick={() => setForm(f => ({ ...f, foodType: 'solid' }))}>固体（克）</button>
              <button className={form.foodType === 'liquid' ? 'active' : ''} onClick={() => setForm(f => ({ ...f, foodType: 'liquid' }))}>液体（毫升）</button>
            </div>
          </div>
          <div className="create-food-row">
            <span className="create-food-label required">蛋白质</span>
            <input
              type="number"
              value={form.protein}
              min="0"
              max="100"
              step="0.1"
              placeholder="必填"
              onChange={(e) => setForm(f => ({ ...f, protein: e.target.value }))}
            />
            <span className="create-food-per">克/每100</span>
          </div>
          <div className="create-food-row">
            <span className="create-food-label required">脂肪</span>
            <input
              type="number"
              value={form.fat}
              min="0"
              max="100"
              step="0.1"
              placeholder="必填"
              onChange={(e) => setForm(f => ({ ...f, fat: e.target.value }))}
            />
            <span className="create-food-per">克/每100</span>
          </div>
          <div className="create-food-row">
            <span className="create-food-label required">碳水化合物</span>
            <input
              type="number"
              value={form.carb}
              min="0"
              max="100"
              step="0.1"
              placeholder="必填"
              onChange={(e) => setForm(f => ({ ...f, carb: e.target.value }))}
            />
            <span className="create-food-per">克/每100</span>
          </div>
          {error && <div className="entry-error">{error}</div>}
          <div className="create-food-actions">
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '处理中…' : '保存修改'}
            </button>
            <button className="btn-secondary" onClick={() => { setForm(null); setError(''); }}>取消</button>
            <button className="btn-danger" onClick={handleDelete} disabled={saving}>🗑️ 删除食物</button>
          </div>
        </div>
      )}
    </div>
  );
};

// 每日目标弹窗：记录人数切换 + 每人独立填写身体信息与目标（分量为多人总量，对比时自动除以人数）
const GoalModal = ({ unit, onClose, onSaved }) => {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const str = (v) => (v === null || v === undefined ? '' : String(v));
  const emptyPerson = { name: '', gender: '', age: '', height: '', weight: '', energy: '', carb: '', protein: '', fat: '' };
  // 后端返回的 { people_count, persons } 转表单结构，热量按页面当前单位预填
  const fillForm = (data) => {
    const count = data?.people_count === 1 ? 1 : 2;
    const displayUnit = unit === 'kJ' ? 'kJ' : 'kcal';
    const bySeq = {};
    (data?.persons || []).forEach(p => { bySeq[p.seq] = p; });
    const persons = [1, 2].slice(0, count).map(seq => {
      const p = bySeq[seq];
      if (!p) return { ...emptyPerson };
      const energy = (p.target_kcal === null || p.target_kcal === undefined)
        ? ''
        : String(displayUnit === 'kJ' ? Math.round(p.target_kcal * KCAL_TO_KJ) : Math.round(p.target_kcal));
      return {
        name: str(p.name),
        gender: p.gender || '',
        age: str(p.age),
        height: str(p.height_cm),
        weight: str(p.weight_kg),
        energy,
        carb: str(p.target_carb),
        protein: str(p.target_protein),
        fat: str(p.target_fat),
      };
    });
    setForm({ peopleCount: count, energyUnit: displayUnit, persons });
  };

  // 打开时拉取当前设置
  useEffect(() => {
    const load = async () => {
      try {
        const response = await getGoals();
        if (response.success) fillForm(response.data);
      } catch (err) {
        console.error('Error loading goals:', err);
      }
    };
    load();
  }, []);

  if (!form) {
    return (
      <div className="food-admin-body">
        <div className="food-admin-header">
          <h3>🎯 每日目标</h3>
          <button className="modal-close" onClick={onClose} title="关闭">✕</button>
        </div>
        <p className="goal-loading">加载中…</p>
      </div>
    );
  }

  // 切换热量单位：换算所有人输入值，保持实际能量不变
  const handleUnitSwitch = (newUnit) => {
    if (newUnit === form.energyUnit) return;
    const convert = (raw) => {
      const v = parseFloat(raw);
      if (isNaN(v)) return '';
      const kcal = form.energyUnit === 'kJ' ? v / KCAL_TO_KJ : v;
      const next = newUnit === 'kJ' ? kcal * KCAL_TO_KJ : kcal;
      return String(Math.round(next));
    };
    setForm(f => ({
      ...f,
      energyUnit: newUnit,
      persons: f.persons.map(p => ({ ...p, energy: convert(p.energy) })),
    }));
  };

  const handlePeopleCount = (count) => {
    setForm(f => ({ ...f, peopleCount: count, persons: [1, 2].slice(0, count).map(seq => f.persons[seq - 1] || { ...emptyPerson }) }));
  };

  const updatePerson = (idx, patch) => {
    setForm(f => ({ ...f, persons: f.persons.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  };

  const handleSave = async () => {
    const numChecks = [
      ['年龄', 'age', 1, 120],
      ['身高', 'height', 50, 250],
      ['体重', 'weight', 20, 500],
      ['热量目标', 'energy', 1, 20000],
      ['碳水目标', 'carb', 0, 1000],
      ['蛋白质目标', 'protein', 0, 1000],
      ['脂肪目标', 'fat', 0, 1000],
    ];
    for (let i = 0; i < form.persons.length; i++) {
      const p = form.persons[i];
      for (const [label, key, min, max] of numChecks) {
        if (p[key] === '') continue;
        const num = parseFloat(p[key]);
        if (isNaN(num) || num < min || num > max) {
          setError(`成员${i + 1} ${label}需在 ${min}-${max} 之间`);
          return;
        }
      }
    }
    setSaving(true);
    setError('');
    try {
      const response = await updateGoals({
        people_count: form.peopleCount,
        unit: form.energyUnit,
        persons: form.persons.map(p => ({
          name: p.name.trim() || null,
          gender: p.gender || null,
          age: p.age === '' ? null : parseFloat(p.age),
          height_cm: p.height === '' ? null : parseFloat(p.height),
          weight_kg: p.weight === '' ? null : parseFloat(p.weight),
          target_kcal: p.energy === '' ? null : parseFloat(p.energy),
          target_carb: p.carb === '' ? null : parseFloat(p.carb),
          target_protein: p.protein === '' ? null : parseFloat(p.protein),
          target_fat: p.fat === '' ? null : parseFloat(p.fat),
        })),
      });
      if (response.success) {
        onSaved();
        onClose();
      } else {
        setError(response.message || '保存失败');
      }
    } catch (err) {
      setError(err.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const goalInput = (label, value, onChange, suffix, min, max, step = '1') => (
    <div className="create-food-row">
      <span className="create-food-label">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder="留空为未设置"
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="create-food-per">{suffix}</span>
    </div>
  );

  const textInput = (label, value, onChange, placeholder) => (
    <div className="create-food-row">
      <span className="create-food-label">{label}</span>
      <input
        type="text"
        value={value}
        maxLength="20"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  const personCard = (p, idx) => (
    <div className="person-card" key={idx}>
      <div className="person-card-title">👤 成员{idx + 1}{p.name ? `：${p.name}` : ''}</div>
      {textInput('称呼', p.name, (v) => updatePerson(idx, { name: v }), '选填，如「我」「老婆」')}
      <div className="create-food-row">
        <span className="create-food-label">性别</span>
        <div className="segment-toggle">
          <button className={p.gender === 'male' ? 'active' : ''} onClick={() => updatePerson(idx, { gender: p.gender === 'male' ? '' : 'male' })}>男</button>
          <button className={p.gender === 'female' ? 'active' : ''} onClick={() => updatePerson(idx, { gender: p.gender === 'female' ? '' : 'female' })}>女</button>
        </div>
      </div>
      {goalInput('年龄', p.age, (v) => updatePerson(idx, { age: v }), '岁', 1, 120)}
      {goalInput('身高', p.height, (v) => updatePerson(idx, { height: v }), 'cm', 50, 250, '0.1')}
      {goalInput('体重', p.weight, (v) => updatePerson(idx, { weight: v }), 'kg', 20, 500, '0.1')}
      {goalInput('热量目标', p.energy, (v) => updatePerson(idx, { energy: v }), form.energyUnit === 'kJ' ? '千焦 kJ' : '千卡 kcal', 1, 20000)}
      {goalInput('碳水目标', p.carb, (v) => updatePerson(idx, { carb: v }), '克', 0, 1000)}
      {goalInput('蛋白质目标', p.protein, (v) => updatePerson(idx, { protein: v }), '克', 0, 1000)}
      {goalInput('脂肪目标', p.fat, (v) => updatePerson(idx, { fat: v }), '克', 0, 1000)}
    </div>
  );

  return (
    <div className="food-admin-body">
      <div className="food-admin-header">
        <h3>🎯 每日目标</h3>
        <button className="modal-close" onClick={onClose} title="关闭">✕</button>
      </div>

      <div className="admin-note">
        ℹ️ 食物分量为 {form.peopleCount} 人总量，主页按 总量 ÷ {form.peopleCount} 算出每人摄入，再与每人各自的目标对比
      </div>

      <div className="create-food-form">
        <div className="create-food-row">
          <span className="create-food-label">记录人数</span>
          <div className="segment-toggle">
            <button className={form.peopleCount === 1 ? 'active' : ''} onClick={() => handlePeopleCount(1)}>1 人</button>
            <button className={form.peopleCount === 2 ? 'active' : ''} onClick={() => handlePeopleCount(2)}>2 人</button>
          </div>
        </div>
        <div className="create-food-row">
          <span className="create-food-label">热量单位</span>
          <div className="segment-toggle">
            <button className={form.energyUnit === 'kcal' ? 'active' : ''} onClick={() => handleUnitSwitch('kcal')}>千卡 kcal</button>
            <button className={form.energyUnit === 'kJ' ? 'active' : ''} onClick={() => handleUnitSwitch('kJ')}>千焦 kJ</button>
          </div>
        </div>

        {form.persons.map(personCard)}

        {error && <div className="entry-error">{error}</div>}
        <div className="create-food-actions">
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存目标'}
          </button>
          <button className="btn-secondary" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
};

export default CaloriePage;
