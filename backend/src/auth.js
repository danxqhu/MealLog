const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'meal-log-secret-key-2026';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未登录' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
  }
};

module.exports = { verifyToken, JWT_SECRET };
