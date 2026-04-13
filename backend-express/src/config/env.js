/**
 * Environment variable loader.
 * All required vars are validated at startup with a clear error message.
 * Set these on Render: Service → Environment tab.
 */

const required = (key, hint) => {
  const val = process.env[key];
  if (!val) {
    const lines = [
      ``,
      `  ╔══════════════════════════════════════════════════════╗`,
      `  ║  MISSING REQUIRED ENV VAR: ${key.padEnd(26)}║`,
      `  ╚══════════════════════════════════════════════════════╝`,
      ``,
      `  Set it in:`,
      `    • Local: backend-express/.env  →  ${key}=<value>`,
      `    • Render: Dashboard → your service → Environment → Add variable`,
      hint ? `\n  Hint: ${hint}` : '',
      ``,
    ].join('\n');
    console.error(lines);
    process.exit(1);
  }
  return val;
};

const MONGODB_URI = required(
  'MONGODB_URI',
  'Get this from MongoDB Atlas → your cluster → Connect → Drivers.\n' +
  '  Format: mongodb+srv://<user>:<password>@cluster0.XXXXX.mongodb.net/<dbname>?retryWrites=true&w=majority\n' +
  '  Common issues:\n' +
  '    - Wrong cluster ID (the XXXXX part) — copy fresh from Atlas\n' +
  '    - Cluster is paused (Atlas free tier pauses after 60 days idle)\n' +
  '    - IP not allowlisted — add 0.0.0.0/0 in Atlas → Network Access\n' +
  '    - Special chars in password not URL-encoded (@ → %40, # → %23)'
);

// Warn if URI still looks like a placeholder
if (
  MONGODB_URI.includes('xxxxx') ||
  MONGODB_URI.includes('<user>') ||
  MONGODB_URI.includes('<password>')
) {
  console.error('\n  ⚠️  MONGODB_URI still contains placeholder text — update it with real credentials.\n');
  process.exit(1);
}

module.exports = {
  NODE_ENV:             process.env.NODE_ENV || 'development',
  PORT:                 process.env.PORT || 3000,
  MONGODB_URI,
  JWT_SECRET:           required('JWT_SECRET',         'Any long random string, e.g. run: node -e "console.log(require(\'crypto\').randomBytes(40).toString(\'hex\'))"'),
  JWT_REFRESH_SECRET:   required('JWT_REFRESH_SECRET',  'Same as JWT_SECRET but a different value'),
  JWT_EXPIRES_IN:       process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  UPLOAD_DIR:           process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE_MB:     parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
  CLIENT_URL:           process.env.CLIENT_URL || '*',
};
