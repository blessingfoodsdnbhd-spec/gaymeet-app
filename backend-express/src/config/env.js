const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
  CLIENT_URL: process.env.CLIENT_URL || '*',
};
