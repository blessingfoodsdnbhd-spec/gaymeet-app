// Western (sun-sign) zodiac + age derivation from a date of birth.
//
// DOB is the source of truth: age is computed live (so it never goes stale on
// a birthday) and the zodiac sign is derived from the month/day. All math is
// done in UTC — an ISO 'YYYY-MM-DD' date persists as midnight UTC, so using UTC
// getters keeps the sign/age stable regardless of server timezone.

// Sign keyed by month: the "early" sign covers day <= CUTOFF[month-1], else the
// next sign. ORDER[0] = Capricorn (Jan), wrapping back to Capricorn in Dec.
const ORDER = [
  'capricorn', 'aquarius', 'pisces', 'aries', 'taurus', 'gemini',
  'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius',
];
const CUTOFF = [19, 18, 20, 19, 20, 20, 22, 22, 22, 22, 21, 21]; // by month 1-12

const SIGN_META = {
  aries:       { en: 'Aries',       zh: '白羊', emoji: '♈', range: '3/21-4/19' },
  taurus:      { en: 'Taurus',      zh: '金牛', emoji: '♉', range: '4/20-5/20' },
  gemini:      { en: 'Gemini',      zh: '双子', emoji: '♊', range: '5/21-6/20' },
  cancer:      { en: 'Cancer',      zh: '巨蟹', emoji: '♋', range: '6/21-7/22' },
  leo:         { en: 'Leo',         zh: '狮子', emoji: '♌', range: '7/23-8/22' },
  virgo:       { en: 'Virgo',       zh: '处女', emoji: '♍', range: '8/23-9/22' },
  libra:       { en: 'Libra',       zh: '天秤', emoji: '♎', range: '9/23-10/22' },
  scorpio:     { en: 'Scorpio',     zh: '天蝎', emoji: '♏', range: '10/23-11/21' },
  sagittarius: { en: 'Sagittarius', zh: '射手', emoji: '♐', range: '11/22-12/21' },
  capricorn:   { en: 'Capricorn',   zh: '摩羯', emoji: '♑', range: '12/22-1/19' },
  aquarius:    { en: 'Aquarius',    zh: '水瓶', emoji: '♒', range: '1/20-2/18' },
  pisces:      { en: 'Pisces',      zh: '双鱼', emoji: '♓', range: '2/19-3/20' },
};

/** Coerce input to a valid Date, or null. Accepts Date | ISO string. */
function toDate(dob) {
  if (!dob) return null;
  const d = dob instanceof Date ? dob : new Date(dob);
  return isNaN(d.getTime()) ? null : d;
}

/** Whole years from dob to now (UTC), or null if dob is missing/invalid. */
function computeAge(dob) {
  const d = toDate(dob);
  if (!d) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age >= 0 ? age : null;
}

/**
 * Sun-sign for a dob.
 * @returns {{ key, en, zh, emoji, range } | null}
 */
function computeZodiac(dob) {
  const d = toDate(dob);
  if (!d) return null;
  const month = d.getUTCMonth() + 1; // 1-12
  const day = d.getUTCDate();
  const key = day <= CUTOFF[month - 1] ? ORDER[month - 1] : ORDER[month % 12];
  return { key, ...SIGN_META[key] };
}

module.exports = { computeAge, computeZodiac, SIGN_META };
