/**
 * World Chat rooms (广场). 'world' is the default/global room; the rest are
 * country rooms. Shared by routes/worldChat.js and services/socketService.js
 * so the valid-id set and labels stay in sync. Socket.io room name = `wc:<id>`.
 */
const ROOMS = [
  { id: 'world', en: 'World', zh: '世界', native: '世界', flag: '🌍' },
  { id: 'MY', en: 'Malaysia', zh: '马来西亚', native: 'Malaysia', flag: '🇲🇾' },
  { id: 'CN', en: 'China', zh: '中国', native: '中国', flag: '🇨🇳' },
  { id: 'KR', en: 'Korea', zh: '韩国', native: '한국', flag: '🇰🇷' },
  { id: 'JP', en: 'Japan', zh: '日本', native: '日本', flag: '🇯🇵' },
  { id: 'TW', en: 'Taiwan', zh: '台湾', native: '台灣', flag: '🇹🇼' },
  { id: 'HK', en: 'Hong Kong', zh: '香港', native: '香港', flag: '🇭🇰' },
  { id: 'US', en: 'United States', zh: '美国', native: 'USA', flag: '🇺🇸' },
  { id: 'TH', en: 'Thailand', zh: '泰国', native: 'ไทย', flag: '🇹🇭' },
  { id: 'VN', en: 'Vietnam', zh: '越南', native: 'Việt Nam', flag: '🇻🇳' },
  { id: 'SG', en: 'Singapore', zh: '新加坡', native: 'Singapore', flag: '🇸🇬' },
  { id: 'ID', en: 'Indonesia', zh: '印尼', native: 'Indonesia', flag: '🇮🇩' },
  { id: 'PH', en: 'Philippines', zh: '菲律宾', native: 'Pilipinas', flag: '🇵🇭' },
  { id: 'GB', en: 'United Kingdom', zh: '英国', native: 'UK', flag: '🇬🇧' },
  { id: 'AU', en: 'Australia', zh: '澳大利亚', native: 'Australia', flag: '🇦🇺' },
];

const VALID_ROOM_IDS = new Set(ROOMS.map((r) => r.id));
const socketRoom = (roomId) => `wc:${roomId}`;

module.exports = { ROOMS, VALID_ROOM_IDS, socketRoom };
