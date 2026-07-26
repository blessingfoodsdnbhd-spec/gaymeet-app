#!/usr/bin/env node
/**
 * marketing-metrics.js — real KPI pull for the marketing loop.
 *
 *   node scripts/marketing-metrics.js            # human-readable report
 *   node scripts/marketing-metrics.js --json     # machine-readable
 *   node scripts/marketing-metrics.js --md       # markdown table (paste into marketing-metrics.md)
 *   node scripts/marketing-metrics.js --days=14  # trend window (default 30)
 *
 * READ-ONLY. Aggregate counts only — never reads or prints any user's
 * personal data. Safe to run against production.
 *
 * ── Revenue source ──────────────────────────────────────────────────────────
 * Exact, as of 2026-07-26: the Apple/Google verify + webhook handlers now call
 * services/iapRevenue.js, which writes one Payment row per purchased period
 * (idempotent — restore-purchase and webhook retries collapse to one row).
 *
 * Purchases made BEFORE 2026-07-26 have no Payment row. They are not counted
 * and were never reliably countable; don't try to backfill them from
 * premiumExpiresAt, which cannot distinguish a sale from a hand-granted comp.
 *
 * ── The premium-count trap ──────────────────────────────────────────────────
 * User.isPremium is NOT a paying customer. On 2026-07-26, 34 of 35 premium
 * users had premiumExpiresAt in 2056 — hand-granted comps. Always read
 * `likelyPaid`, never `flaggedPremium`.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DAY = 86400000;
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const asMd = argv.includes('--md');
const daysArg = argv.find((a) => a.startsWith('--days='));
const TREND_DAYS = daysArg ? Math.max(1, parseInt(daysArg.split('=')[1], 10) || 30) : 30;

const REVENUE_SOURCE = 'payments'; // 'inferred' | 'payments'
// Purchase event log went live 2026-07-26 (services/iapRevenue.js). Anything
// bought before that date has no Payment row and will not appear here — that
// is correct, not a bug: there was nothing reliable to backfill from.
const REVENUE_LOG_START = '2026-07-26';

// Server-side price table — mirrors routes/subscriptions.js. Used to turn
// counts into MYR. Keep in sync if prices change.
const PRICE = { monthly: 39.9, yearly: 399.9 };

// Real users only: no demo/review accounts, no deleted accounts.
const REAL = { isDemo: { $ne: true }, isDeleted: { $ne: true } };

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing — run from backend-express/ with .env present.');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  const User = require('../src/models/User');
  const Payment = require('../src/models/Payment');

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfYesterday = new Date(+startOfToday - DAY);
  const since = new Date(+startOfToday - TREND_DAYS * DAY);

  // ── Registrations ─────────────────────────────────────────────────────────
  const [totalUsers, newYesterday, newToday, new7d, new30d] = await Promise.all([
    User.countDocuments(REAL),
    User.countDocuments({ ...REAL, createdAt: { $gte: startOfYesterday, $lt: startOfToday } }),
    User.countDocuments({ ...REAL, createdAt: { $gte: startOfToday } }),
    User.countDocuments({ ...REAL, createdAt: { $gte: new Date(+startOfToday - 7 * DAY) } }),
    User.countDocuments({ ...REAL, createdAt: { $gte: new Date(+startOfToday - 30 * DAY) } }),
  ]);

  const dailySignups = await User.aggregate([
    { $match: { ...REAL, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);

  // ── Activity ──────────────────────────────────────────────────────────────
  const [dau, wau, mau] = await Promise.all([
    User.countDocuments({ ...REAL, lastActiveAt: { $gte: new Date(+now - DAY) } }),
    User.countDocuments({ ...REAL, lastActiveAt: { $gte: new Date(+now - 7 * DAY) } }),
    User.countDocuments({ ...REAL, lastActiveAt: { $gte: new Date(+now - 30 * DAY) } }),
  ]);

  // ── Geography — this is what makes content attribution possible ───────────
  // Post in Thai → watch TH signups. Post on 小红书 → watch MY/SG.
  const byCountry = await User.aggregate([
    { $match: { ...REAL, createdAt: { $gte: since } } },
    { $group: { _id: { $ifNull: ['$countryCode', 'unknown'] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 12 },
  ]);

  // ── Premium / revenue ─────────────────────────────────────────────────────
  // A real purchase can only buy up to 1 year at a time (longest SKU = 365d),
  // so anything expiring more than ~2 years out was granted by hand, not paid
  // for. Counting those as revenue is how you end up reporting a business that
  // doesn't exist — as of 2026-07-26, 34 of 35 "premium" users expire in 2056.
  const GRANT_HORIZON = new Date(+now + 730 * DAY);

  const [activePremium, grantedPremium, paidPremium, googleTokens] = await Promise.all([
    User.countDocuments({
      ...REAL,
      isPremium: true,
      $or: [{ premiumExpiresAt: null }, { premiumExpiresAt: { $gt: now } }],
    }),
    User.countDocuments({
      ...REAL,
      isPremium: true,
      $or: [{ premiumExpiresAt: null }, { premiumExpiresAt: { $gt: GRANT_HORIZON } }],
    }),
    User.countDocuments({
      ...REAL,
      isPremium: true,
      premiumExpiresAt: { $gt: now, $lte: GRANT_HORIZON },
    }),
    User.countDocuments({ ...REAL, googleOriginalPurchaseToken: { $ne: null } }),
  ]);

  let newPremiumYesterday = null;
  let inferredMrr = null;
  let paymentsNote = null;

  if (REVENUE_SOURCE === 'payments') {
    const rows = await Payment.aggregate([
      { $match: { type: 'premium', createdAt: { $gte: startOfYesterday, $lt: startOfToday } } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]);
    newPremiumYesterday = rows[0]?.n || 0;
    inferredMrr = rows[0]?.amount || 0;
  } else {
    // Infer "bought yesterday" from expiry landing exactly one plan-length away.
    const win = (lenDays) => ({
      ...REAL,
      isPremium: true,
      premiumExpiresAt: {
        $gte: new Date(+startOfYesterday + lenDays * DAY),
        $lt: new Date(+startOfToday + lenDays * DAY),
      },
    });
    const [m, y] = await Promise.all([
      User.countDocuments(win(30)),
      User.countDocuments(win(365)),
    ]);
    newPremiumYesterday = m + y;
    inferredMrr = m * PRICE.monthly + y * PRICE.yearly;
    paymentsNote =
      'inferred from premiumExpiresAt (no purchase event log — see script header)';
  }

  const totalPayments = await Payment.countDocuments({});

  const out = {
    generatedAt: now.toISOString(),
    trendDays: TREND_DAYS,
    users: { total: totalUsers, newToday, newYesterday, new7d, new30d },
    activity: { dau, wau, mau },
    premium: {
      flaggedPremium: activePremium,
      grantedNotPaid: grantedPremium,
      likelyPaid: paidPremium,
      googlePurchaseTokens: googleTokens,
      newYesterday: newPremiumYesterday,
      estimatedRevenueYesterdayMYR: Number(inferredMrr.toFixed(2)),
      note: paymentsNote,
      paymentDocsInDb: totalPayments,
    },
    dailySignups: dailySignups.map((d) => ({ date: d._id, signups: d.count })),
    signupsByCountry: byCountry.map((c) => ({ country: c._id, signups: c.count })),
  };

  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
  } else if (asMd) {
    console.log(renderMd(out));
  } else {
    renderText(out);
  }

  await mongoose.disconnect();
}

function renderMd(o) {
  const L = [];
  L.push(`<!-- AUTO-GENERATED by backend-express/scripts/marketing-metrics.js — do not hand-edit -->`);
  L.push(`_数据时间：${o.generatedAt}（UTC）_`);
  L.push('');
  L.push('| 指标 | 数值 |');
  L.push('|---|---|');
  L.push(`| 累计真实注册用户 | **${o.users.total}** |`);
  L.push(`| 昨日新注册 | **${o.users.newYesterday}** |`);
  L.push(`| 今日至今新注册 | ${o.users.newToday} |`);
  L.push(`| 近 7 天新注册 | ${o.users.new7d} |`);
  L.push(`| 近 30 天新注册 | ${o.users.new30d} |`);
  L.push(`| DAU（24h 内活跃） | **${o.activity.dau}** |`);
  L.push(`| WAU（7d） | ${o.activity.wau} |`);
  L.push(`| MAU（30d） | ${o.activity.mau} |`);
  L.push(`| 标记为 VIP 的账号 | ${o.premium.flaggedPremium} |`);
  L.push(`|  其中：人工赠送（到期日 >2 年） | ${o.premium.grantedNotPaid} |`);
  L.push(`|  其中：**可能是真实付费** | **${o.premium.likelyPaid}** |`);
  L.push(`| Google Play 购买凭证数 | ${o.premium.googlePurchaseTokens} |`);
  const tag = o.premium.note ? '推算' : '精确';
  L.push(`| 昨日新增 VIP（${tag}） | ${o.premium.newYesterday} |`);
  L.push(`| 昨日 VIP 收入（${tag}，MYR） | ${o.premium.estimatedRevenueYesterdayMYR} |`);
  if (!o.premium.note) L.push(`| 购买事件日志起始 | ${REVENUE_LOG_START} |`);
  L.push('');
  if (o.premium.note) L.push(`> ⚠️ VIP 数字为**推算值**：${o.premium.note}`);
  L.push('');
  L.push(`**近 ${o.trendDays} 天每日注册**`);
  L.push('');
  L.push('| 日期 | 新注册 |');
  L.push('|---|---|');
  o.dailySignups.slice(0, 14).forEach((d) => L.push(`| ${d.date} | ${d.signups} |`));
  L.push('');
  L.push(`**近 ${o.trendDays} 天注册来源国家**（内容归因就看这张表）`);
  L.push('');
  L.push('| 国家 | 新注册 |');
  L.push('|---|---|');
  o.signupsByCountry.forEach((c) => L.push(`| ${c.country} | ${c.signups} |`));
  return L.join('\n');
}

function renderText(o) {
  const p = (s) => console.log(s);
  p('');
  p('═══ Meyou — Marketing KPI ═══');
  p(`generated: ${o.generatedAt} (UTC)`);
  p('');
  p('REGISTRATIONS');
  p(`  total (real users)    ${o.users.total}`);
  p(`  yesterday             ${o.users.newYesterday}`);
  p(`  today so far          ${o.users.newToday}`);
  p(`  last 7d / 30d         ${o.users.new7d} / ${o.users.new30d}`);
  p('');
  p('ACTIVITY');
  p(`  DAU / WAU / MAU       ${o.activity.dau} / ${o.activity.wau} / ${o.activity.mau}`);
  p('');
  p('PREMIUM');
  p(`  flagged premium       ${o.premium.flaggedPremium}`);
  p(`    granted (not paid)  ${o.premium.grantedNotPaid}`);
  p(`    likely PAID         ${o.premium.likelyPaid}`);
  p(`  google purchase toks  ${o.premium.googlePurchaseTokens}`);
  p(`  new yesterday         ${o.premium.newYesterday}`);
  p(`  est. revenue (MYR)    ${o.premium.estimatedRevenueYesterdayMYR}`);
  if (o.premium.note) p(`  ⚠️  ${o.premium.note}`);
  else p(`  source: exact Payment log (since ${REVENUE_LOG_START})`);
  p(`  Payment docs in DB    ${o.premium.paymentDocsInDb}`);
  p('');
  p(`DAILY SIGNUPS (last ${Math.min(14, o.dailySignups.length)} shown)`);
  o.dailySignups.slice(0, 14).forEach((d) => {
    p(`  ${d.date}  ${String(d.signups).padStart(4)}  ${'█'.repeat(Math.min(40, d.signups))}`);
  });
  p('');
  p('SIGNUPS BY COUNTRY (content attribution)');
  o.signupsByCountry.forEach((c) => {
    p(`  ${String(c.country).padEnd(10)} ${String(c.signups).padStart(5)}`);
  });
  p('');
}

main().catch((e) => {
  console.error('marketing-metrics failed:', e.message);
  process.exit(1);
});
