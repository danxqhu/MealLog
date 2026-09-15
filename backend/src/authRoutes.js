const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./database');
const { JWT_SECRET, verifyToken } = require('./auth');

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, securityQuestion, securityAnswer } = req.body;

    if (!username || !password || !securityQuestion || !securityAnswer) {
      return res.status(400).json({ success: false, message: '请填写所有字段' });
    }

    if (username.length < 2) {
      return res.status(400).json({ success: false, message: '用户名至少2个字符' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: '密码至少8位' });
    }

    // 检查用户名是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?', [username]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    // 加密密码和安全问题答案
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);

    const [result] = await pool.execute(
      'INSERT INTO users (username, password, security_question, security_answer) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, securityQuestion, hashedAnswer]
    );

    // 注册后直接生成 token 登录
    const token = jwt.sign({ userId: result.insertId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: { token, username }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请填写用户名和密码' });
    }

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ?', [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: '登录成功',
      data: { token, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 验证 token 是否有效
router.get('/verify', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Token有效' });
});

// 忘记密码 - 第一步：获取安全问题
router.get('/forgot-password/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const [users] = await pool.execute(
      'SELECT security_question FROM users WHERE username = ?', [username]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      data: { question: users[0].security_question }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 忘记密码 - 第二步：验证答案并重设密码
router.post('/reset-password', async (req, res) => {
  try {
    const { username, securityAnswer, newPassword } = req.body;

    if (!username || !securityAnswer || !newPassword) {
      return res.status(400).json({ success: false, message: '请填写所有字段' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: '密码至少8位' });
    }

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ?', [username]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.security_answer);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: '安全问题答案不正确' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]
    );

    res.json({ success: true, message: '密码重置成功，请登录' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

module.exports = router;
