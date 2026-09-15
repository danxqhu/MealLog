import React, { useState } from 'react';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Register = ({ onLogin, onGoLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password || !confirmPassword || !securityQuestion.trim() || !securityAnswer.trim()) {
      setError('请填写所有字段');
      return;
    }

    if (username.trim().length < 2) {
      setError('用户名至少2个字符');
      return;
    }

    if (password.length < 8) {
      setError('密码至少8位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          securityQuestion: securityQuestion.trim(),
          securityAnswer: securityAnswer.trim(),
        }),
      });
      const data = await response.json();

      if (data.success) {
        onLogin(data.data.token, data.data.username);
      } else {
        setError(data.message || '注册失败');
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
          <p>创建新账号</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名（唯一）"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少8位"
            />
          </div>

          <div className="auth-field">
            <label>确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
            />
          </div>

          <div className="auth-field">
            <label>安全问题</label>
            <input
              type="text"
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
              placeholder="如：你的宠物叫什么名字？"
            />
          </div>

          <div className="auth-field">
            <label>安全问题答案</label>
            <input
              type="text"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              placeholder="用于忘记密码时验证身份"
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="auth-footer">
          <button className="auth-link" onClick={onGoLogin}>已有账号？去登录</button>
        </div>
      </div>
    </div>
  );
};

export default Register;
