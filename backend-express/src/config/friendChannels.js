/**
 * Plaza 交友频道 (friend channels) — standalone, social-icebreaker chat rooms
 * grouped under the ❤️ 交友 tab. Like interest channels they aren't tied to a
 * country. Ids are namespaced `friend:<slug>`. Each channel id IS its own
 * 总聊天室 (main chat room); user-created rooms attach to it via channelId.
 * Shape mirrors interestChannels.js. Order = Plaza display order (Phase 4 spec §3.1).
 */
module.exports = [
  { id: 'friend:late-night', emoji: '🌙', name: '深夜聊天', i18nKey: 'plaza.friend.lateNight' },
  { id: 'friend:singles', emoji: '💘', name: '单身交友', i18nKey: 'plaza.friend.singles' },
  { id: 'friend:overseas', emoji: '🌏', name: '海外华人', i18nKey: 'plaza.friend.overseas' },
  { id: 'friend:voice-match', emoji: '🎙️', name: '语音速配', i18nKey: 'plaza.friend.voiceMatch' },
  { id: 'friend:buddies', emoji: '🤝', name: '找搭子', i18nKey: 'plaza.friend.buddies' },
  { id: 'friend:meal-mates', emoji: '🍽️', name: '找饭友', i18nKey: 'plaza.friend.mealMates' },
  { id: 'friend:travel-mates', emoji: '✈️', name: '找旅行伙伴', i18nKey: 'plaza.friend.travelMates' },
  { id: 'friend:biz-partners', emoji: '💼', name: '找创业伙伴', i18nKey: 'plaza.friend.bizPartners' },
  { id: 'friend:overseas-room', emoji: '🏠', name: '海外华人房', i18nKey: 'plaza.friend.overseasRoom' },
];
