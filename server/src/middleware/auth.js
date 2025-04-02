const jwt = require('jsonwebtoken');
const config = require('../../config.json');

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Ошибка проверки токена:', err);
    res.status(403).json({ error: 'Неверный токен' });
  }
}

function generateToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '1h' });
}

module.exports = { authenticate, generateToken };