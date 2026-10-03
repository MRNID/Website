const crypto = require('crypto');
const { users, findUserByUsername } = require('../config/users');

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function authenticateUser({ username, password }) {
  const user = findUserByUsername(username);

  if (!user || !user.isActive) {
    return null;
  }

  const hashedPassword = hashPassword(password);

  return user.password === hashedPassword ? sanitizeUser(user) : null;
}

function signToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    tenantId: user.tenantId,
    role: user.role,
    exp: Date.now() + 8 * 60 * 60 * 1000,
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function verifyToken(token) {
  if (!token) return null;

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));

    if (!decoded || decoded.exp < Date.now()) {
      return null;
    }

    const user = users.find((item) => item.id === decoded.sub);
    return user ? sanitizeUser(user) : null;
  } catch (error) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : '';
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Token không hợp lệ hoặc đã hết hạn.',
    });
  }

  req.user = user;
  return next();
}

module.exports = {
  authenticateUser,
  hashPassword,
  sanitizeUser,
  signToken,
  verifyToken,
  requireAuth,
};
