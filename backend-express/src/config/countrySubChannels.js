/**
 * Country sub-channels (🌏 国家). Every country room is split into these four
 * sub-channels, giving room ids like `country:my:general`, `country:sg:social`.
 * The `general` sub-channel is the default landing when a country is opened.
 * worldChatRooms.js fans these out across every country in ROOMS (minus the
 * global 'world' lobby) to build the rankable + joinable room set.
 */
module.exports = [
  { key: 'general', emoji: '#', name: '总聊天室', i18nKey: 'plaza.country.subchannel.general' },
  { key: 'social', emoji: '#', name: '交友区', i18nKey: 'plaza.country.subchannel.social' },
  { key: 'newcomers', emoji: '#', name: '新人区', i18nKey: 'plaza.country.subchannel.newcomers' },
  { key: 'events', emoji: '#', name: '活动区', i18nKey: 'plaza.country.subchannel.events' },
];
