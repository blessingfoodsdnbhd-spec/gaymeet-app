/**
 * Country sub-channels (🌏 国家). Every country room is split into these four
 * FIXED sub-channels (Phase 4 spec §5.1), giving room ids like
 * `country:my:general`, `country:sg:social`. These are system-provided and
 * cannot be created/deleted by users; they always sit above the country's
 * user-created rooms. The `general` (总聊天室) sub-channel is the default landing.
 * Order matters — it's the display order: 总聊天室 → 新人报到 → 交友区 → 吹水区.
 * worldChatRooms.js fans these out across every country in ROOMS to build the
 * rankable + joinable room set.
 */
module.exports = [
  { key: 'general', emoji: '#', name: '总聊天室', i18nKey: 'plaza.country.subchannel.general' },
  { key: 'newcomers', emoji: '#', name: '新人报到', i18nKey: 'plaza.country.subchannel.newcomers' },
  { key: 'social', emoji: '#', name: '交友区', i18nKey: 'plaza.country.subchannel.social' },
  { key: 'chitchat', emoji: '#', name: '吹水区', i18nKey: 'plaza.country.subchannel.chitchat' },
];
