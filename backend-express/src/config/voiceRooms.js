/**
 * Plaza voice rooms (🎤 语音) — DISPLAY-ONLY placeholders. Voice infrastructure
 * (Phase 4) isn't built yet, so these are NOT real chat rooms: they're not in
 * VALID_ROOM_IDS and can't be joined or posted to. The 🎤 tab lists them with a
 * "即将推出" badge. Shape mirrors topicRooms.js / interestChannels.js.
 *
 * Note: 深夜吹水 intentionally also exists as a text topic room — same name,
 * different room type (text vs voice).
 */
module.exports = [
  { id: 'voice:late-night', emoji: '🎤', name: '深夜吹水', i18nKey: 'plaza.voice.lateNight' },
  { id: 'voice:cantonese', emoji: '🎤', name: '广东话房', i18nKey: 'plaza.voice.cantonese' },
  { id: 'voice:my-chinese', emoji: '🎤', name: '马来西亚华人', i18nKey: 'plaza.voice.myChinese' },
  { id: 'voice:entrepreneurs', emoji: '🎤', name: '创业老板', i18nKey: 'plaza.voice.entrepreneurs' },
];
