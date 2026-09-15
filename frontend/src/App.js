import React, { useState } from 'react';
import './App.css';
import { useAuth } from './AuthContext';
import Calendar from './components/Calendar';
import StatsChart from './components/StatsChart';
import MealModal from './components/MealModal';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import { getMealsByDate } from './api';

function App() {
  const { user, loading, login, logout } = useAuth();
  const [authPage, setAuthPage] = useState('login'); // login, register, forgot

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [meals, setMeals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('calendar');
  const [refreshKey, setRefreshKey] = useState(0);

  // 加载中
  if (loading) {
    return <div className="App"><div style={{ padding: 50, textAlign: 'center' }}>加载中...</div></div>;
  }

  // 未登录 - 显示认证页面
  if (!user) {
    if (authPage === 'register') {
      return <Register onLogin={login} onGoLogin={() => setAuthPage('login')} />;
    }
    if (authPage === 'forgot') {
      return <ForgotPassword onGoLogin={() => setAuthPage('login')} />;
    }
    return (
      <Login
        onLogin={login}
        onGoRegister={() => setAuthPage('register')}
        onGoForgot={() => setAuthPage('forgot')}
      />
    );
  }

  // 已登录 - 主应用

  // 加载选中日期的餐饮记录
  const loadMeals = async (date) => {
    const dateStr = formatDate(date);
    try {
      const response = await getMealsByDate(dateStr);
      if (response.success) {
        setMeals(response.data);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  // 格式化日期为 YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 处理日期点击
  const handleDateClick = (date) => {
    setSelectedDate(date);
    loadMeals(date);
  };

  // 关闭模态框
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDate(null);
    setMeals([]);
  };

  // 刷新日历数据，同时重新加载弹窗中的记录
  const refreshCalendar = async () => {
    setRefreshKey(k => k + 1);
    if (selectedDate) {
      const dateStr = formatDate(selectedDate);
      try {
        const response = await getMealsByDate(dateStr);
        if (response.success) {
          setMeals(response.data);
        }
      } catch (error) {
        console.error('Error reloading meals:', error);
      }
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-top">
          <h1>🍽️ 饮食记录</h1>
          <div className="user-info">
            <span className="username">{user.username}</span>
            <button className="logout-button" onClick={logout}>退出</button>
          </div>
        </div>
        <div className="view-toggle">
          <button
            className={viewMode === 'calendar' ? 'active' : ''}
            onClick={() => setViewMode('calendar')}
          >
            📅 日历
          </button>
          <button
            className={viewMode === 'stats' ? 'active' : ''}
            onClick={() => setViewMode('stats')}
          >
            📊 统计
          </button>
        </div>
      </header>

      <main>
        {viewMode === 'calendar' ? (
          <Calendar
            currentDate={currentDate}
            onDateClick={handleDateClick}
            onRefresh={refreshCalendar}
            onMonthChange={setCurrentDate}
            refreshKey={refreshKey}
          />
        ) : (
          <StatsChart currentDate={currentDate} />
        )}
      </main>

      {showModal && selectedDate && (
        <MealModal
          date={selectedDate}
          meals={meals}
          onClose={handleCloseModal}
          onDataChange={refreshCalendar}
        />
      )}
    </div>
  );
}

export default App;
