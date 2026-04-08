const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccess(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function signRefresh(userId) {
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

function verifyRefresh(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

module.exports = { signAccess, signRefresh, verifyRefresh };
