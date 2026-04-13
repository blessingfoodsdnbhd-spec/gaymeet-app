const User = require('../models/User');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)

function randomCode(len = 6) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

/**
 * Generate a unique 6-char referral code, retrying on collision.
 */
async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode(6);
    const exists = await User.findOne({ referralCode: code });
    if (!exists) return code;
  }
  // Fallback: use timestamp suffix to guarantee uniqueness
  return randomCode(4) + Date.now().toString(36).toUpperCase().slice(-2);
}

module.exports = generateUniqueReferralCode;
