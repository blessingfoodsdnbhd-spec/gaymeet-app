/**
 * World Chat rooms (广场). 'world' is the default/global room; the rest are
 * country rooms. Topic rooms (🔥 热门) and interest channels (🎮 兴趣) live in
 * their own config files and are merged into ALL_ROOMS below. Shared by
 * routes/worldChat.js and services/socketService.js so the valid-id set and
 * labels stay in sync. Socket.io room name = `wc:<id>`.
 */
const TOPIC_ROOMS = require('./topicRooms');
const INTEREST_CHANNELS = require('./interestChannels');

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
 * `kind` lets the client pin topics first in 热门 and populate the 兴趣 sheet.
 * Country rooms carry per-locale labels; topic/interest rooms carry an i18nKey
 * the client resolves with t() (so they localize to all 4 languages).
 */
const toRecord = (r, kind) =>
  kind === 'country'
    ? { id: r.id, flag: r.flag, label: { en: r.en, zh: r.zh, native: r.native }, kind }
    : { id: r.id, flag: r.emoji, label: { en: r.name, zh: r.name, native: r.name }, kind, i18nKey: r.i18nKey };

// Order matters for the default `/rooms` response: topics, then countries, then
// interest channels. The /rooms?sort=hot view re-orders by live online count.
const ALL_ROOMS = [
  ...TOPIC_ROOMS.map((r) => toRecord(r, 'topic')),
  ...ROOMS.map((r) => toRecord(r, 'country')),
  ...INTEREST_CHANNELS.map((r) => toRecord(r, 'interest')),
];

const VALID_ROOM_IDS = new Set(ALL_ROOMS.map((r) => r.id));
const socketRoom = (roomId) => `wc:${roomId}`;

module.exports = {
  ROOMS,
  TOPIC_ROOMS,
  INTEREST_CHANNELS,
  ALL_ROOMS,
  VALID_ROOM_IDS,
  socketRoom,
};
