/**
 * Smoke test for User.toPublicJSON allowlist serialization.
 *
 * Run: node scripts/smoke-user-serialization.js
 * No DB connection needed — mongoose instantiates the doc offline.
 *
 * Asserts:
 *   - No sensitive field (password, fcmToken, devices/IPs, OTP/reset codes,
 *     IAP tokens, etc.) ever appears, for self OR other viewers.
 *   - Self-only fields (email, coins, economy state) appear ONLY for self.
 *   - preferences.virtualLat/Lng (teleport) never reach another user.
 *   - Public profile fields are always present.
 *   - User.PUBLIC_PROJECTION excludes every sensitive + self-only field.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'smoke';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/smoke';

const User = require('../src/models/User');

const u = new User({
  email: 'secret@example.com',
  password: 'HASH',
  nickname: 'Tester',
  bio: 'hi',
  age: 28,
  avatarUrl: 'a.png',
  photos: ['p1.png'],
  isPremium: true,
  coins: 999,
  ticketBalance: 5,
  referralCode: 'ABC123',
  fcmToken: 'FCMTOKEN',
  deviceFingerprint: 'FP',
  otpCode: '123456',
  resetCode: '654321',
  googleId: 'gid',
  appleId: 'aid',
  appleOriginalTransactionId: 'apple-txn',
  googleOriginalPurchaseToken: 'goog-token',
  loginAttempts: 3,
  lockoutUntil: new Date(),
  devices: [{ deviceId: 'd1', ip: '1.2.3.4', refreshToken: 'RT' }],
  preferences: { hideDistance: true, virtualLat: 1.23, virtualLng: 4.56, stealthMode: true },
});

const MUST_NEVER = [
  'password', 'fcmToken', 'deviceFingerprint', 'otpCode', 'otpExpiry',
  'resetCode', 'resetCodeExpiry', 'googleId', 'appleId',
  'appleOriginalTransactionId', 'googleOriginalPurchaseToken',
  'devices', 'blockedUsers', 'loginAttempts', 'lockoutUntil', '__v',
];
const SELF_ONLY = ['email', 'coins', 'ticketBalance', 'referralCode'];

function check(label, obj, expectSelf) {
  let pass = true;
  const leaks = MUST_NEVER.filter((f) => f in obj);
  if (leaks.length) { pass = false; console.log(`  FAIL ${label}: leaked ${leaks.join(', ')}`); }
  if (!expectSelf && obj.preferences && 'virtualLat' in obj.preferences) {
    pass = false; console.log(`  FAIL ${label}: leaked preferences.virtualLat`);
  }
  if (expectSelf) {
    const missing = SELF_ONLY.filter((f) => !(f in obj));
    if (missing.length) { pass = false; console.log(`  FAIL ${label}: self missing ${missing.join(', ')}`); }
  } else {
    const present = SELF_ONLY.filter((f) => f in obj);
    if (present.length) { pass = false; console.log(`  FAIL ${label}: exposed self-only ${present.join(', ')}`); }
  }
  for (const f of ['id', 'nickname', 'age', 'avatarUrl', 'isPremium']) {
    if (!(f in obj)) { pass = false; console.log(`  FAIL ${label}: missing public ${f}`); }
  }
  if (pass) console.log(`  PASS ${label} (${Object.keys(obj).length} keys)`);
  return pass;
}

let ok = true;
console.log('User.toPublicJSON allowlist smoke test:');
ok = check('SELF', u.toPublicJSON(), true) && ok;
ok = check('OTHER', u.toPublicJSON(undefined, { self: false }), false) && ok;

const proj = User.PUBLIC_PROJECTION;
for (const f of [...MUST_NEVER, ...SELF_ONLY]) {
  if (f === '__v') continue;
  if (proj[f] !== 0) { ok = false; console.log(`  FAIL PUBLIC_PROJECTION missing ${f}`); }
}

console.log(ok ? 'ALL_SMOKE_PASS' : 'SMOKE_FAIL');
process.exit(ok ? 0 : 1);
