/**
 * Interest channels (兴趣频道) for the Plaza — themed public rooms that reuse the
 * World-Chat infrastructure. Each channel's room id is `interest:<key>`, shared
 * by routes/worldChat.js (send/recent), routes/plaza.js (list) and
 * services/socketService.js (presence) so the valid-id set + labels stay in
 * sync. Socket.io room name = `wc:interest:<key>` (via socketRoom()).
 *
 * This is the canonical seed list (admin-configured). routes/plaza.js lazily
 * upserts it into the InterestChannel collection on first read, so the DB copy
 * can later carry admin edits (pinned, description) without a migration.
 */
const CHANNELS = [
  { key: 'games',       emoji: '🎮', i18nKey: 'plaza.channel.games',     en: 'Games',        zh: '游戏' },
  { key: 'food',        emoji: '🍜', i18nKey: 'plaza.channel.food',      en: 'Food',         zh: '美食' },
  { key: 'movies',      emoji: '🎬', i18nKey: 'plaza.channel.movies',    en: 'Movies',       zh: '电影' },
  { key: 'fitness',     emoji: '💪', i18nKey: 'plaza.channel.fitness',   en: 'Fitness',      zh: '健身' },
  { key: 'pets',        emoji: '🐱', i18nKey: 'plaza.channel.pets',      en: 'Pets',         zh: '宠物' },
  { key: 'dating',      emoji: '💘', i18nKey: 'plaza.channel.dating',    en: 'Dating',       zh: '交友' },
  { key: 'travel',      emoji: '✈️', i18nKey: 'plaza.channel.travel',    en: 'Travel',       zh: '旅游' },
  { key: 'startup',     emoji: '📈', i18nKey: 'plaza.channel.startup',   en: 'Startups',     zh: '创业' },
  { key: 'ai',          emoji: '📱', i18nKey: 'plaza.channel.ai',        en: 'AI',           zh: 'AI 讨论' },
  { key: 'realestate',  emoji: '🏠', i18nKey: 'plaza.channel.realestate',en: 'Real estate',  zh: '房地产' },
];

/** `interest:games` → channel key `games`. Room id is what travels over the wire. */
const channelRoomId = (key) => `interest:${key}`;

const CHANNEL_ROOM_IDS = new Set(CHANNELS.map((c) => channelRoomId(c.key)));

/** True for `interest:<key>` ids that map to a real seeded channel. */
const isInterestRoomId = (id) =>
  typeof id === 'string' && CHANNEL_ROOM_IDS.has(id);

module.exports = { CHANNELS, channelRoomId, CHANNEL_ROOM_IDS, isInterestRoomId };
