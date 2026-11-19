// 生产模式下走相对路径，由 nginx 反代到后端（见 frontend/nginx.conf 的 /api/ 代理），
// 这样同一台服务器部署多个实例时前端无需在构建期烘焙不同的后端地址；
// 本地开发时用 docker-compose.override.yml 里的 REACT_APP_API_URL 指到宿主机端口
const API_URL = process.env.REACT_APP_API_URL || '';

// 获取带 token 的请求头
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// 处理响应，检测 401 自动登出
const handleResponse = async (response) => {
  if (response.status === 401) {
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('登录已过期');
  }
  return response.json();
};

export const getMealsByDate = async (date) => {
  const response = await fetch(`${API_URL}/api/meals/${date}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const addMeal = async (mealData) => {
  const response = await fetch(`${API_URL}/api/meals`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(mealData),
  });
  return handleResponse(response);
};

export const updateMeal = async (id, mealData) => {
  const response = await fetch(`${API_URL}/api/meals/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(mealData),
  });
  return handleResponse(response);
};

export const deleteMeal = async (id) => {
  const response = await fetch(`${API_URL}/api/meals/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getMealsByRange = async (startDate, endDate) => {
  const response = await fetch(
    `${API_URL}/api/meals/range?startDate=${startDate}&endDate=${endDate}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse(response);
};

export const getRestaurants = async () => {
  const response = await fetch(`${API_URL}/api/restaurants`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getMonthlyStats = async (year, month) => {
  const response = await fetch(
    `${API_URL}/api/stats/monthly?year=${year}&month=${month}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse(response);
};

export const getMonthlyDailyStats = async (year, month) => {
  const response = await fetch(
    `${API_URL}/api/stats/monthly/daily?year=${year}&month=${month}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse(response);
};

export const getQuarterlyStats = async (year, quarter) => {
  const response = await fetch(
    `${API_URL}/api/stats/quarterly?year=${year}&quarter=${quarter}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse(response);
};

export const getQuarterlyWeeklyStats = async (year, quarter) => {
  const response = await fetch(
    `${API_URL}/api/stats/quarterly/weekly?year=${year}&quarter=${quarter}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse(response);
};

export const getYearlyStats = async (year) => {
  const response = await fetch(`${API_URL}/api/stats/yearly?year=${year}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getFirstYear = async () => {
  const response = await fetch(`${API_URL}/api/stats/first-year`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ==================== 卡路里相关接口 ====================

export const searchFoods = async (search) => {
  const response = await fetch(
    `${API_URL}/api/foods?search=${encodeURIComponent(search || '')}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse(response);
};

export const addFood = async (foodData) => {
  const response = await fetch(`${API_URL}/api/foods`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(foodData),
  });
  return handleResponse(response);
};

export const updateFood = async (id, foodData) => {
  const response = await fetch(`${API_URL}/api/foods/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(foodData),
  });
  return handleResponse(response);
};

export const deleteFood = async (id) => {
  const response = await fetch(`${API_URL}/api/foods/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getCaloriesByDate = async (date) => {
  const response = await fetch(`${API_URL}/api/calories/${date}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getCaloriesByRange = async (startDate, endDate) => {
  const response = await fetch(
    `${API_URL}/api/calories/range?startDate=${startDate}&endDate=${endDate}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse(response);
};

export const addCalorieEntry = async (entryData) => {
  const response = await fetch(`${API_URL}/api/calories`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(entryData),
  });
  return handleResponse(response);
};

export const updateCalorieEntry = async (id, entryData) => {
  const response = await fetch(`${API_URL}/api/calories/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(entryData),
  });
  return handleResponse(response);
};

export const deleteCalorieEntry = async (id) => {
  const response = await fetch(`${API_URL}/api/calories/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getGoals = async () => {
  const response = await fetch(`${API_URL}/api/goals`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// 每日合计热量目标历史（每天取当时生效的快照，修改目标不回溯影响过去日期）
export const getGoalsHistory = async (startDate, endDate) => {
  const response = await fetch(
    `${API_URL}/api/goals/history?startDate=${startDate}&endDate=${endDate}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse(response);
};

export const updateGoals = async (goalsData) => {
  const response = await fetch(`${API_URL}/api/goals`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(goalsData),
  });
  return handleResponse(response);
};

// ==================== 减重目标（体重称重记录）接口 ====================

export const getWeights = async () => {
  const response = await fetch(`${API_URL}/api/weights`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const addWeight = async (weightData) => {
  const response = await fetch(`${API_URL}/api/weights`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(weightData),
  });
  return handleResponse(response);
};

export const deleteWeight = async (id) => {
  const response = await fetch(`${API_URL}/api/weights/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export default { getMealsByDate, addMeal, updateMeal, deleteMeal, getMealsByRange, getRestaurants, getMonthlyStats, getMonthlyDailyStats, getQuarterlyStats, getQuarterlyWeeklyStats, getYearlyStats, getFirstYear, searchFoods, addFood, updateFood, deleteFood, getCaloriesByDate, getCaloriesByRange, addCalorieEntry, updateCalorieEntry, deleteCalorieEntry, getGoals, updateGoals, getWeights, addWeight, deleteWeight };
