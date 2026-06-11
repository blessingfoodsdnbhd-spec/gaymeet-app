/**
 * World Chat rooms (广场) — Phase 4 channel architecture (spec §2–§5).
 *
 * Four top-level categories of 二级频道, each fanned into joinable rooms:
 *   交友 (friend:*)   — friendChannels.js   · kind 'friend'
 *   语音 (voice:*)    — voiceRooms.js        · kind 'voice'  (text until audio ships)
 *   兴趣 (interest:*) — interestChannels.js  · kind 'interest'
 *   国家 (country)    — ROOMS below          · kind 'country', split into 4 sub-boards
 *
 * A friend/voice/interest channel id IS its own 总聊天室 (a joinable room). A
 * country is entered via one of its 4 fixed sub-boards (country:<cc>:<key>);
 * 世界大厅's 总聊天室 keeps the legacy id 'world' so its history is preserved.
 * Topic rooms (🔥) remain as extra rankable rooms surfaced only in 热门.
 *
 * User-created rooms (UGC) attach to a CHANNEL via `channelId` (a country code
 * or a friend:/voice:/interest: id) — see CHANNEL_IDS. Socket.io room = `wc:<id>`.
 */
const TOPIC_ROOMS = require('./topicRooms');
const FRIEND_CHANNELS = require('./friendChannels');
const INTEREST_CHANNELS = require('./interestChannels');
const VOICE_ROOMS = require('./voiceRooms');
const COUNTRY_SUB_CHANNELS = require('./countrySubChannels');

const ROOMS = [
  { id: 'world', en: 'World', zh: '世界大厅', native: '世界大厅', flag: '🌍' },
  { id: 'MY', en: 'Malaysia', zh: '马来西亚', native: 'Malaysia', flag: '🇲🇾' },
  { id: 'SG', en: 'Singapore', zh: '新加坡', native: 'Singapore', flag: '🇸🇬' },
  { id: 'CN', en: 'China', zh: '中国', native: 'China', flag: '🇨🇳' },
  { id: 'TW', en: 'Taiwan', zh: '台湾', native: '台灣', flag: '🇹🇼' },
  { id: 'HK', en: 'Hong Kong', zh: '香港', native: 'Hong Kong', flag: '🇭🇰' },
  { id: 'JP', en: 'Japan', zh: '日本', native: 'Japan', flag: '🇯🇵' },
  { id: 'KR', en: 'Korea', zh: '韩国', native: '한국', flag: '🇰🇷' },
  { id: 'TH', en: 'Thailand', zh: '泰国', native: 'ไทย', flag: '🇹🇭' },
  { id: 'VN', en: 'Vietnam', zh: '越南', native: 'Việt Nam', flag: '🇻🇳' },
  { id: 'ID', en: 'Indonesia', zh: '印尼', native: 'Indonesia', flag: '🇮🇩' },
  { id: 'PH', en: 'Philippines', zh: '菲律宾', native: 'Pilipinas', flag: '🇵🇭' },
  { id: 'US', en: 'United States', zh: '美国', native: 'USA', flag: '🇺🇸' },
  { id: 'CA', en: 'Canada', zh: '加拿大', native: 'Canada', flag: '🇨🇦' },
  { id: 'GB', en: 'United Kingdom', zh: '英国', native: 'UK', flag: '🇬🇧' },
  { id: 'AU', en: 'Australia', zh: '澳大利亚', native: 'Australia', flag: '🇦🇺' },
];

/**
 * Normalized room record consumed by the /rooms endpoint + socket counts.
 * Country rooms carry per-locale labels; channel/sub-channel rooms carry an
 * i18nKey the client resolves with t() (localizes to all 4 languages), plus a
 * `name` fallback inside label so a missing translation degrades gracefully.
 */
const toRecord = (r, kind) =>
  kind === 'country'
    ? { id: r.id, flag: r.flag, label: { en: r.en, zh: r.zh, native: r.native }, kind }
    : { id: r.id, flag: r.emoji, label: { en: r.name, zh: r.name, native: r.name }, kind, i18nKey: r.i18nKey };

// Canonical id for a country sub-channel. 世界大厅's 总聊天室 stays 'world' so the
// global lobby's existing history is preserved; everything else is namespaced.
const subChannelId = (countryCode, key) =>
  countryCode === 'world' && key === 'general' ? 'world' : `country:${String(countryCode).toLowerCase()}:${key}`;

// Fan every country (INCLUDING 世界大厅) out into its 4 fixed sub-boards. The
// country flag rides along so 热门 can render "🇲🇾 总聊天室".
const COUNTRY_SUB_ROOMS = ROOMS.flatMap((c) =>
  COUNTRY_SUB_CHANNELS.map((s) => ({
    id: subChannelId(c.id, s.key),
    flag: c.flag,
    label: { en: s.name, zh: s.name, native: s.name },
    kind: 'country-sub',
    i18nKey: s.i18nKey,
    country: c.id,
    sub: s.key,
  })),
);

// The full rankable + joinable room set. Order: topics, countries (identity),
// friend / interest / voice channels, then country sub-boards. The /rooms?sort
// =hot view re-orders by live online count.
const ALL_ROOMS = [
  ...TOPIC_ROOMS.map((r) => toRecord(r, 'topic')),
  ...ROOMS.map((r) => toRecord(r, 'country')),
  ...FRIEND_CHANNELS.map((r) => toRecord(r, 'friend')),
  ...INTEREST_CHANNELS.map((r) => toRecord(r, 'interest')),
  ...VOICE_ROOMS.map((r) => toRecord(r, 'voice')),
  ...COUNTRY_SUB_ROOMS,
];

const VALID_ROOM_IDS = new Set(ALL_ROOMS.map((r) => r.id));
const socketRoom = (roomId) => `wc:${roomId}`;

// ── Channel helpers (UGC parent channels) ────────────────────────────────────
// A "channel" is a 二级频道 that user-created rooms can hang under: any country
// code (incl 'world') or a friend:/voice:/interest: id. Topic rooms + country
// sub-boards are NOT UGC parents.
const COUNTRY_CODES = new Set(ROOMS.map((r) => r.id));
const CHANNEL_IDS = new Set([
  ...ROOMS.map((r) => r.id),
  ...FRIEND_CHANNELS.map((r) => r.id),
  ...INTEREST_CHANNELS.map((r) => r.id),
  ...VOICE_ROOMS.map((r) => r.id),
]);

const isCountryChannel = (id) => COUNTRY_CODES.has(id);
const isValidChannel = (id) => CHANNEL_IDS.has(id);

module.exports = {
  ROOMS,
  TOPIC_ROOMS,
  FRIEND_CHANNELS,
  INTEREST_CHANNELS,
  VOICE_ROOMS,
  COUNTRY_SUB_CHANNELS,
  COUNTRY_SUB_ROOMS,
  ALL_ROOMS,
  VALID_ROOM_IDS,
  CHANNEL_IDS,
  COUNTRY_CODES,
  subChannelId,
  socketRoom,
  isCountryChannel,
  isValidChannel,
};
