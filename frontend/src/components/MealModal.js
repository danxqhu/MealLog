import React, { useState, useEffect } from 'react';
import './MealModal.css';
import { addMeal, updateMeal, deleteMeal, getRestaurants } from '../api';

const MealModal = ({ date, meals, onClose, onDataChange }) => {
  const [restaurantName, setRestaurantName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [diningType, setDiningType] = useState('dine_out');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRestaurant, setEditRestaurant] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDiningType, setEditDiningType] = useState('dine_out');
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [showAddSuggestions, setShowAddSuggestions] = useState(false);
  const [showEditSuggestions, setShowEditSuggestions] = useState(false);

  // 加载历史店名列表
  useEffect(() => {
    const loadRestaurants = async () => {
      try {
        const response = await getRestaurants();
        if (response.success) {
          setAllRestaurants(response.data);
        }
      } catch (error) {
        console.error('Error loading restaurants:', error);
      }
    };
    loadRestaurants();
  }, []);

  // 根据输入过滤店名建议
  const filterSuggestions = (input) => {
    if (!input.trim()) return allRestaurants;
    return allRestaurants.filter(name =>
      name.toLowerCase().includes(input.toLowerCase())
    );
  };

  // 格式化日期显示
  const formatDateDisplay = () => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekDay = weekDays[date.getDay()];
    return `${year}年${month}月${day}日 ${weekDay}`;
  };

  // 处理添加餐饮
  const handleAddMeal = async (e) => {
    e.preventDefault();
    
    if (!restaurantName.trim() || amount === '' || amount === null) {
      alert('请填写完整信息');
      return;
    }

    if (parseFloat(amount) < 0) {
      alert('金额不能为负数');
      return;
    }

    if (parseFloat(amount) > 10000) {
      alert('金额不能大于 10000 元');
      return;
    }

    try {
      const response = await addMeal({
        meal_date: formatDateForAPI(date),
        restaurant_name: restaurantName.trim(),
        amount: parseFloat(amount),
        notes: notes.trim() || null,
        dining_type: diningType
      });

      if (response.success) {
        // 清空表单
        setRestaurantName('');
        setAmount('');
        setNotes('');
        setDiningType('dine_out');
        setIsAdding(false);
        setShowAddSuggestions(false);
        // 刷新数据，同时重新加载店名列表
        onDataChange();
        const r = await getRestaurants();
        if (r.success) setAllRestaurants(r.data);
      }
    } catch (error) {
      console.error('Error adding meal:', error);
      alert('添加失败，请重试');
    }
  };

  // 格式化日期为 API 格式
  const formatDateForAPI = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 处理编辑餐饮
  const handleEditMeal = (meal) => {
    setEditingId(meal.id);
    setEditRestaurant(meal.restaurant_name);
    setEditAmount(meal.amount.toString());
    setEditNotes(meal.notes || '');
    setEditDiningType(meal.dining_type || 'dine_out');
    setIsAdding(false);
  };

  // 处理保存编辑
  const handleSaveEdit = async (e) => {
    e.preventDefault();

    if (!editRestaurant.trim() || editAmount === '' || editAmount === null) {
      alert('请填写完整信息');
      return;
    }

    if (parseFloat(editAmount) < 0) {
      alert('金额不能为负数');
      return;
    }

    if (parseFloat(editAmount) > 10000) {
      alert('金额不能大于 10000 元');
      return;
    }

    try {
      const response = await updateMeal(editingId, {
        restaurant_name: editRestaurant.trim(),
        amount: parseFloat(editAmount),
        notes: editNotes.trim() || null,
        dining_type: editDiningType
      });

      if (response.success) {
        setEditingId(null);
        setEditRestaurant('');
        setEditAmount('');
        setEditNotes('');
        setEditDiningType('dine_out');
        setShowEditSuggestions(false);
        onDataChange();
        const r = await getRestaurants();
        if (r.success) setAllRestaurants(r.data);
      }
    } catch (error) {
      console.error('Error updating meal:', error);
      alert('修改失败，请重试');
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditRestaurant('');
    setEditAmount('');
    setEditNotes('');
    setEditDiningType('dine_out');
  };

  // 处理删除餐饮
  const handleDeleteMeal = async (id) => {
    if (!window.confirm('确定要删除这条记录吗？')) {
      return;
    }

    try {
      const response = await deleteMeal(id);
      if (response.success) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error deleting meal:', error);
      alert('删除失败，请重试');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{formatDateDisplay()}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* 显示已有记录 */}
          <div className="meals-list">
            {meals.length === 0 ? (
              <div className="no-meals">当天还没有记录，点击下方按钮开始记录吧！</div>
            ) : (
              meals.map((meal) => (
                <div key={meal.id} className="meal-item">
                  {editingId === meal.id ? (
                    <form onSubmit={handleSaveEdit} className="edit-meal-form">
                      <div className="form-group restaurant-input-wrapper">
                        <input
                          type="text"
                          value={editRestaurant}
                          onChange={(e) => { setEditRestaurant(e.target.value); setShowEditSuggestions(true); }}
                          onFocus={() => setShowEditSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowEditSuggestions(false), 200)}
                          placeholder="店名"
                          autoFocus
                        />
                        {showEditSuggestions && filterSuggestions(editRestaurant).length > 0 && (
                          <ul className="suggestions-list">
                            {filterSuggestions(editRestaurant).map((name, idx) => (
                              <li key={idx} onMouseDown={() => { setEditRestaurant(name); setShowEditSuggestions(false); }}>
                                {name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="form-group">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder="花费金额"
                          step="0.01"
                          min="0"
                          max="10000"
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="备注（可选）"
                        />
                      </div>
                      <div className="form-group">
                        <div className="dining-type-group">
                          <label className={`dining-type-option ${editDiningType === 'delivery' ? 'active' : ''}`}>
                            <input
                              type="radio"
                              name="edit_dining_type"
                              value="delivery"
                              checked={editDiningType === 'delivery'}
                              onChange={(e) => setEditDiningType(e.target.value)}
                            />
                            <span className="dining-type-label">外卖</span>
                          </label>
                          <label className={`dining-type-option ${editDiningType === 'dine_out' ? 'active' : ''}`}>
                            <input
                              type="radio"
                              name="edit_dining_type"
                              value="dine_out"
                              checked={editDiningType === 'dine_out'}
                              onChange={(e) => setEditDiningType(e.target.value)}
                            />
                            <span className="dining-type-label">外出就餐</span>
                          </label>
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="save-button">保存</button>
                        <button type="button" className="cancel-button" onClick={handleCancelEdit}>取消</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="meal-details">
                        <div className="meal-restaurant">
                          {meal.restaurant_name}
                          <span className={`dining-type-tag ${meal.dining_type === 'delivery' ? 'tag-delivery' : 'tag-dine-out'}`}>
                            {meal.dining_type === 'delivery' ? '外卖' : '外出就餐'}
                          </span>
                        </div>
                        {Number(meal.amount) === 0 ? (
                          <div className="meal-free-tag">🆓 免费</div>
                        ) : (
                          <div className="meal-price">¥{Number(meal.amount).toFixed(2)}</div>
                        )}
                        {meal.notes && <div className="meal-notes">{meal.notes}</div>}
                      </div>
                      <div className="meal-actions">
                        <button
                          className="edit-button"
                          onClick={() => handleEditMeal(meal)}
                        >
                          编辑
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteMeal(meal.id)}
                        >
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 添加新记录表单 */}
          {isAdding && (
            <form onSubmit={handleAddMeal} className="add-meal-form">
              <h4>添加新记录</h4>
              <div className="form-group restaurant-input-wrapper">
                <input
                  type="text"
                  placeholder="店名（如：麦当劳、肯德基...）"
                  value={restaurantName}
                  onChange={(e) => { setRestaurantName(e.target.value); setShowAddSuggestions(true); }}
                  onFocus={() => setShowAddSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowAddSuggestions(false), 200)}
                  autoFocus
                />
                {showAddSuggestions && filterSuggestions(restaurantName).length > 0 && (
                  <ul className="suggestions-list">
                    {filterSuggestions(restaurantName).map((name, idx) => (
                      <li key={idx} onMouseDown={() => { setRestaurantName(name); setShowAddSuggestions(false); }}>
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="form-group">
                <input
                  type="number"
                  placeholder="花费金额"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  max="10000"
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="备注（可选）"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="form-group">
                <div className="dining-type-group">
                  <label className={`dining-type-option ${diningType === 'delivery' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="dining_type"
                      value="delivery"
                      checked={diningType === 'delivery'}
                      onChange={(e) => setDiningType(e.target.value)}
                    />
                    <span className="dining-type-label">外卖</span>
                  </label>
                  <label className={`dining-type-option ${diningType === 'dine_out' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="dining_type"
                      value="dine_out"
                      checked={diningType === 'dine_out'}
                      onChange={(e) => setDiningType(e.target.value)}
                    />
                    <span className="dining-type-label">外出就餐</span>
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="save-button">保存</button>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setIsAdding(false)}
                >
                  取消
                </button>
              </div>
            </form>
          )}

          {/* 添加按钮 */}
          {!isAdding && (
            <button className="add-meal-button" onClick={() => { setIsAdding(true); setEditingId(null); }}>
              + 添加饮食记录
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MealModal;
