/**
 * Plaza interest channels (兴趣频道) — standalone topic rooms grouped under the
 * 🎮 兴趣 tab. Like topic rooms they aren't tied to a country. Ids are
 * namespaced `interest:<slug>`. Each channel id IS its own 总聊天室; user-created
 * rooms attach to it via channelId. Order = Plaza display order (Phase 4 spec §3.3).
 */
module.exports = [
  { id: 'interest:late-night', emoji: '🌙', name: '深夜吹水房', i18nKey: 'plaza.channel.lateNight' },
  { id: 'interest:food', emoji: '🍜', name: '美食', i18nKey: 'plaza.channel.food' },
  { id: 'interest:photo', emoji: '📸', name: '摄影', i18nKey: 'plaza.channel.photo' },
  { id: 'interest:games', emoji: '🎮', name: '游戏', i18nKey: 'plaza.channel.games' },
  { id: 'interest:ai', emoji: '🤖', name: 'AI', i18nKey: 'plaza.channel.ai' },
  { id: 'interest:realestate', emoji: '🏠', name: '房地产', i18nKey: 'plaza.channel.realestate' },
  { id: 'interest:startup', emoji: '🚀', name: '创业', i18nKey: 'plaza.channel.startup' },
  { id: 'interest:invest', emoji: '📈', name: '投资', i18nKey: 'plaza.channel.invest' },
  { id: 'interest:pets', emoji: '🐱', name: '宠物', i18nKey: 'plaza.channel.pets' },
  { id: 'interest:movies', emoji: '🎬', name: '电影', i18nKey: 'plaza.channel.movies' },
  { id: 'interest:music', emoji: '🎵', name: '音乐', i18nKey: 'plaza.channel.music' },
  { id: 'interest:travel', emoji: '🧳', name: '旅游', i18nKey: 'plaza.channel.travel' },
  { id: 'interest:cars', emoji: '🚗', name: '汽车', i18nKey: 'plaza.channel.cars' },
  { id: 'interest:fitness', emoji: '💪', name: '健身', i18nKey: 'plaza.channel.fitness' },
  { id: 'interest:study', emoji: '📚', name: '学习', i18nKey: 'plaza.channel.study' },
  { id: 'interest:design', emoji: '🎨', name: '设计', i18nKey: 'plaza.channel.design' },
  { id: 'interest:fashion', emoji: '👗', name: '穿搭', i18nKey: 'plaza.channel.fashion' },
  { id: 'interest:baking', emoji: '🧁', name: '烘焙', i18nKey: 'plaza.channel.baking' },
  { id: 'interest:coffee', emoji: '☕', name: '咖啡', i18nKey: 'plaza.channel.coffee' },
];
