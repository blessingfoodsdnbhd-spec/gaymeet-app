/**
 * Plaza topic rooms (热门话题) — standalone, topic-based chat rooms that anchor
 * the 🔥 热门 tab. Unlike country rooms they aren't tied to a place; they're
 * always shown first in 热门, ranked among themselves by live online count.
 * Ids are namespaced `topic:<slug>`. Shape mirrors interestChannels.js.
 */
module.exports = [
  { id: 'topic:late-night', emoji: '🔥', name: '深夜吹水', i18nKey: 'plaza.topic.lateNight' },
  { id: 'topic:singles', emoji: '🔥', name: '单身交友', i18nKey: 'plaza.topic.singles' },
  { id: 'topic:ai-discuss', emoji: '🔥', name: 'AI 讨论', i18nKey: 'plaza.topic.aiDiscuss' },
];
