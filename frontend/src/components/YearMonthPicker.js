import React, { useState, useRef, useEffect } from 'react';
import './YearMonthPicker.css';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const YearMonthPicker = ({ mode, year, month, quarter, firstYear, onYearChange, onMonthChange, onQuarterChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [panelView, setPanelView] = useState('main'); // 'main' | 'years'
  const containerRef = useRef(null);
  const yearListRef = useRef(null);

  const maxYear = firstYear + 20;

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setPanelView('main');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 打开面板时重置到主视图
  useEffect(() => {
    if (isOpen) setPanelView('main');
  }, [isOpen]);

  // 年份列表打开时滚动到当前年份
  useEffect(() => {
    if (panelView === 'years' && yearListRef.current) {
      const activeEl = yearListRef.current.querySelector('.year-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'center' });
      }
    }
  }, [panelView]);

  // 构造显示文本
  const getDisplayText = () => {
    if (mode === 'month') return `${year}年${month}月`;
    if (mode === 'quarter') return `${year}年 第${quarter}季度`;
    return `${year}年`;
  };

  const handleYearSelect = (y) => {
    onYearChange(y);
    if (mode === 'year') {
      setIsOpen(false);
    } else {
      setPanelView('main');
    }
  };

  const handleMonthSelect = (m) => {
    onMonthChange(m);
    setIsOpen(false);
  };

  const handleQuarterSelect = (q) => {
    onQuarterChange(q);
    setIsOpen(false);
  };

  // 生成年份列表
  const years = [];
  for (let y = firstYear; y <= maxYear; y++) {
    years.push(y);
  }

  return (
    <div className="ymp-container" ref={containerRef}>
      <button className="ymp-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className="ymp-trigger-text">{getDisplayText()}</span>
        <span className={`ymp-arrow ${isOpen ? 'open' : ''}`}>▾</span>
      </button>

      {isOpen && (
        <div className="ymp-panel">
          {panelView === 'main' ? (
            <>
              {/* 顶部年份导航 */}
              <div className="ymp-nav">
                <button
                  className="ymp-nav-btn"
                  onClick={() => year > firstYear && onYearChange(year - 1)}
                  disabled={year <= firstYear}
                >‹</button>
                <button className="ymp-year-label" onClick={() => setPanelView('years')}>
                  {year}年
                </button>
                <button
                  className="ymp-nav-btn"
                  onClick={() => year < maxYear && onYearChange(year + 1)}
                  disabled={year >= maxYear}
                >›</button>
              </div>

              {/* 月度模式：月份网格 */}
              {mode === 'month' && (
                <div className="ymp-grid month-grid">
                  {MONTHS.map((label, idx) => (
                    <button
                      key={idx}
                      className={`ymp-cell ${month === idx + 1 ? 'active' : ''}`}
                      onClick={() => handleMonthSelect(idx + 1)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* 季度模式：季度网格 */}
              {mode === 'quarter' && (
                <div className="ymp-grid quarter-grid">
                  {QUARTERS.map((label, idx) => (
                    <button
                      key={idx}
                      className={`ymp-cell ${quarter === idx + 1 ? 'active' : ''}`}
                      onClick={() => handleQuarterSelect(idx + 1)}
                    >
                      第{idx + 1}季度
                    </button>
                  ))}
                </div>
              )}

              {/* 年度模式：无需额外面板，选年即完成 */}
            </>
          ) : (
            /* 年份选择列表 */
            <div className="ymp-years-view">
              <div className="ymp-years-header">
                <button className="ymp-back-btn" onClick={() => setPanelView('main')}>
                  ‹ 返回
                </button>
              </div>
              <div className="ymp-years-list" ref={yearListRef}>
                {years.map(y => (
                  <button
                    key={y}
                    className={`year-item ${y === year ? 'active' : ''}`}
                    onClick={() => handleYearSelect(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default YearMonthPicker;
