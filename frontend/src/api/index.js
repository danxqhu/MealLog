const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

export default { getMealsByDate, addMeal, updateMeal, deleteMeal, getMealsByRange, getRestaurants, getMonthlyStats, getMonthlyDailyStats, getQuarterlyStats, getQuarterlyWeeklyStats, getYearlyStats, getFirstYear };
