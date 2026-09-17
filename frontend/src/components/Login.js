import React, { useState } from 'react';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || '';
// 生产模式回退到相对路径，由 nginx 反代到后端，避免把 localhost 烘焙进产物

const Login = ({ onLogin, onGoRegister, onGoForgot }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('请填写用户名和密码');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();

      if (data.success) {
        onLogin(data.data.token, data.data.username);
      } else {
        setError(data.message || '登录失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🍽️ 饮食记录</h1>
          <p>登录您的账号</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="auth-footer">
          <button className="auth-link" onClick={onGoForgot}>忘记密码？</button>
          <span className="auth-divider">|</span>
          <button className="auth-link" onClick={onGoRegister}>没有账号？去注册</button>
        </div>
      </div>
    </div>
  );
};

export default Login;
