import React, { useState } from 'react';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ForgotPassword = ({ onGoLogin }) => {
  const [step, setStep] = useState(1); // 1: 输入用户名, 2: 回答问题+重置密码
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // 第一步：查找用户的安全问题
  const handleFindUser = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password/${encodeURIComponent(username.trim())}`);
      const data = await response.json();

      if (data.success) {
        setQuestion(data.data.question);
        setStep(2);
      } else {
        setError(data.message || '用户不存在');
      }
    } catch (err) {
      setError('网络错误，请重试');
    }
    setLoading(false);
  };

  // 第二步：验证答案并重设密码
  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!securityAnswer.trim() || !newPassword || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }

    if (newPassword.length < 8) {
      setError('新密码至少8位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          securityAnswer: securityAnswer.trim(),
          newPassword,
        }),
      });
      const data = await response.json();

      if (data.success) {
        setSuccess('密码重置成功！即将跳转到登录页面...');
        setTimeout(() => onGoLogin(), 2000);
      } else {
        setError(data.message || '重置失败');
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
          <p>忘记密码</p>
        </div>

        {step === 1 && (
          <form onSubmit={handleFindUser} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field">
              <label>用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入您的用户名"
                autoFocus
              />
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '查找中...' : '下一步'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleReset} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <div className="auth-hint">
              <span>用户名：</span><strong>{username}</strong>
            </div>

            <div className="auth-field">
              <label>安全问题</label>
              <div className="auth-question">{question}</div>
            </div>

            <div className="auth-field">
              <label>安全问题答案</label>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="请输入您的答案"
                autoFocus
              />
            </div>

            <div className="auth-field">
              <label>新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少8位"
              />
            </div>

            <div className="auth-field">
              <label>确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '重置中...' : '重置密码'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <button className="auth-link" onClick={onGoLogin}>返回登录</button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
