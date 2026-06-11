/**
 * Plaza interest channels (兴趣频道) — standalone topic rooms grouped under the
 * 🎮 兴趣 tab. Like topic rooms they aren't tied to a country. Ids are
 * namespaced `interest:<slug>`. Shape mirrors topicRooms.js.
 */
module.exports = [
  { id: 'interest:food', emoji: '🍜', name: '美食', i18nKey: 'plaza.channel.food' },
  { id: 'interest:photo', emoji: '📸', name: '摄影', i18nKey: 'plaza.channel.photo' },
  { id: 'interest:games', emoji: '🎮', name: '游戏', i18nKey: 'plaza.channel.games' },
  { id: 'interest:ai', emoji: '🤖', name: 'AI', i18nKey: 'plaza.channel.ai' },
  { id: 'interest:realestate', emoji: '🏠', name: '房产', i18nKey: 'plaza.channel.realestate' },
  { id: 'interest:pets', emoji: '🐱', name: '宠物', i18nKey: 'plaza.channel.pets' },
];
