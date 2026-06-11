/**
 * World Chat rooms (广场). 'world' is the default/global room; the rest are
 * country rooms. Topic rooms (🔥 热门), interest channels (🎮 兴趣) and per-country
 * sub-channels (🌏 国家) live in their own config files and are merged into
 * ALL_ROOMS below. Voice rooms (🎤) are display-only placeholders and stay OUT
 * of the valid-id set. Shared by routes/worldChat.js and services/socketService
 * .js so the valid-id set and labels stay in sync. Socket.io room name = `wc:<id>`.
 */
const TOPIC_ROOMS = require('./topicRooms');
const INTEREST_CHANNELS = require('./interestChannels');
const COUNTRY_SUB_CHANNELS = require('./countrySubChannels');
const VOICE_ROOMS = require('./voiceRooms');

const ROOMS = [
  { id: 'world', en: 'World', zh: '世界', native: '世界', flag: '🌍' },
  { id: 'MY', en: 'Malaysia', zh: '马来西亚', native: 'Malaysia', flag: '🇲🇾' },
  { id: 'CN', en: 'China', zh: '中国', native: 'China', flag: '🇨🇳' },
  { id: 'KR', en: 'Korea', zh: '韩国', native: '한국', flag: '🇰🇷' },
  { id: 'JP', en: 'Japan', zh: '日本', native: 'Japan', flag: '🇯🇵' },
  { id: 'TW', en: 'Taiwan', zh: '台湾', native: '台灣', flag: '🇹🇼' },
  { id: 'HK', en: 'Hong Kong', zh: '香港', native: 'Hong Kong', flag: '🇭🇰' },
  { id: 'US', en: 'United States', zh: '美国', native: 'USA', flag: '🇺🇸' },
  { id: 'TH', en: 'Thailand', zh: '泰国', native: 'ไทย', flag: '🇹🇭' },
  { id: 'VN', en: 'Vietnam', zh: '越南', native: 'Việt Nam', flag: '🇻🇳' },
  { id: 'SG', en: 'Singapore', zh: '新加坡', native: 'Singapore', flag: '🇸🇬' },
  { id: 'ID', en: 'Indonesia', zh: '印尼', native: 'Indonesia', flag: '🇮🇩' },
  { id: 'PH', en: 'Philippines', zh: '菲律宾', native: 'Pilipinas', flag: '🇵🇭' },
  { id: 'GB', en: 'United Kingdom', zh: '英国', native: 'UK', flag: '🇬🇧' },
  { id: 'AU', en: 'Australia', zh: '澳大利亚', native: 'Australia', flag: '🇦🇺' },
];

/**
 * Normalized room record consumed by the /rooms endpoint + socket counts.
 * `kind` lets the client group rooms in 热门 / 国家 / 兴趣. Country rooms carry
 * per-locale labels; topic/interest/sub-channel rooms carry an i18nKey the
 * client resolves with t() (so they localize to all 4 languages).
 */
const toRecord = (r, kind) =>
  kind === 'country'
    ? { id: r.id, flag: r.flag, label: { en: r.en, zh: r.zh, native: r.native }, kind }
    : { id: r.id, flag: r.emoji, label: { en: r.name, zh: r.name, native: r.name }, kind, i18nKey: r.i18nKey };

// Canonical id for a country sub-channel, e.g. ('MY','general') → 'country:my:general'.
const subChannelId = (countryCode, key) => `country:${String(countryCode).toLowerCase()}:${key}`;

// Fan every country (minus the global 'world' lobby) out into its 4 sub-channels.
// The country flag rides along so 热门 can render "🇲🇾 总聊天室" — the flag carries
// the country, the i18nKey-resolved label carries the sub-channel name.
const COUNTRY_SUB_ROOMS = ROOMS.filter((c) => c.id !== 'world').flatMap((c) =>
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

// Order matters for the default `/rooms` response: topics, countries, interest
// channels, then country sub-channels. The /rooms?sort=hot view re-orders by
// live online count.
const ALL_ROOMS = [
  ...TOPIC_ROOMS.map((r) => toRecord(r, 'topic')),
  ...ROOMS.map((r) => toRecord(r, 'country')),
  ...INTEREST_CHANNELS.map((r) => toRecord(r, 'interest')),
  ...COUNTRY_SUB_ROOMS,
];

// Voice rooms are placeholders only — never joinable, so they're excluded here.
const VALID_ROOM_IDS = new Set(ALL_ROOMS.map((r) => r.id));
const socketRoom = (roomId) => `wc:${roomId}`;

module.exports = {
  ROOMS,
  TOPIC_ROOMS,
  INTEREST_CHANNELS,
  COUNTRY_SUB_CHANNELS,
  COUNTRY_SUB_ROOMS,
  VOICE_ROOMS,
  ALL_ROOMS,
  VALID_ROOM_IDS,
  subChannelId,
  socketRoom,
};
