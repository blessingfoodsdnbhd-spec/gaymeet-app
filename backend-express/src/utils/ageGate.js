// 18+ age gate — single source of truth for the minimum age and the DOB
// validation every signup / profile-write path must run.
//
// Meyou is a dating app, so the App Store age rating requires a hard 18+ gate
// (not 13+/17+). The client also bounds its date picker at today−18y, but that
// is UI only — this module is the enforcement point. Never trust a client-sent
// `age`: it is derived from `dob` server-side.
//
// Legacy accounts predate the gate and have `dob === null`. They are NOT locked
// out of sign-in (that would strand real users); the client shows them a
// blocking age-gate screen on next launch, and their next profile write must
// carry a valid adult DOB. See validateDob's `required` flag.

const { computeAge } = require('./zodiac');

const MIN_AGE = 18;

// Bilingual (zh/en/ja/ko) so the raw server string is readable in any locale
// the app ships — the client shows `error` verbatim when it has no local copy.
const MSG = {
  underage: '你必须年满 18 岁才能使用 Meyou / You must be 18 or older to use Meyou / 18歳以上でないと Meyou を利用できません / 18세 이상이어야 Meyou를 이용할 수 있습니다',
  required: '请填写出生日期 / Date of birth is required / 生年月日を入力してください / 생년월일을 입력해 주세요',
  invalid: '出生日期无效 / Invalid date of birth / 生年月日が無効です / 생년월일이 올바르지 않습니다',
};

/** True when `dob` is set and resolves to an age >= MIN_AGE. */
function isAdultDob(dob) {
  const age = computeAge(dob);
  return age != null && age >= MIN_AGE;
}

/**
 * Validate a client-supplied DOB.
 *
 * @param {*} raw       ISO date string | Date | null | undefined
 * @param {object} opts
 * @param {boolean} opts.required  Absent/empty DOB is an error (new accounts).
 * @returns {{ date: Date|null } | { error: string, code: string }}
 *          `date` is null only when !required and nothing was supplied.
 */
function validateDob(raw, { required = false } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) return { error: MSG.required, code: 'DOB_REQUIRED' };
    return { date: null };
  }
  const d = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d.getTime())) return { error: MSG.invalid, code: 'DOB_INVALID' };
  // A future date, or one implying an implausible age, is malformed input
  // rather than an underage user — but both are refused either way.
  if (d.getTime() > Date.now()) return { error: MSG.invalid, code: 'DOB_INVALID' };
  const age = computeAge(d);
  if (age == null || age > 120) return { error: MSG.invalid, code: 'DOB_INVALID' };
  if (age < MIN_AGE) return { error: MSG.underage, code: 'UNDERAGE' };
  return { date: d };
}

module.exports = { MIN_AGE, MSG, isAdultDob, validateDob };
