/**
 * Plaza 语音频道 (voice channels) — grouped under the 🎤 语音 tab. Order = Plaza
 * display order (Phase 4 spec §3.2). Ids are namespaced `voice:<slug>`.
 *
 * NOTE (Phase 4): real-time audio infrastructure is NOT built yet. These are now
 * navigable channels (so the 二级频道 list + 总聊天室 + 用户自建房 structure matches the
 * other categories), but until voice/WebRTC ships they behave as TEXT rooms with
 * a "语音功能即将推出" banner in the room. They ARE in VALID_ROOM_IDS so users can
 * chat in text. TODO: wire up live audio (mic, mixing) and flip these to voice.
 */
module.exports = [
  // '随机配对' (voice:random-match) removed per App Review 1.2 — anonymous
  // random pairing is UGC we no longer offer. The Plaza voice tab also filters
  // this id client-side as a belt-and-braces guard.
  { id: 'voice:singles', emoji: '💘', name: '单身交友', i18nKey: 'plaza.voice.singles' },
  { id: 'voice:cantonese', emoji: '🗣️', name: '广东话房', i18nKey: 'plaza.voice.cantonese' },
  { id: 'voice:mandarin', emoji: '🀄', name: '普通话房', i18nKey: 'plaza.voice.mandarin' },
  { id: 'voice:english', emoji: '🔤', name: '英语交流', i18nKey: 'plaza.voice.english' },
  { id: 'voice:karaoke', emoji: '🎤', name: '唱歌房', i18nKey: 'plaza.voice.karaoke' },
  { id: 'voice:gaming', emoji: '🎮', name: '游戏开黑', i18nKey: 'plaza.voice.gaming' },
  { id: 'voice:bosses', emoji: '💼', name: '创业老板房', i18nKey: 'plaza.voice.bosses' },
  { id: 'voice:ai', emoji: '🤖', name: 'AI 讨论房', i18nKey: 'plaza.voice.ai' },
  { id: 'voice:feelings', emoji: '🕳️', name: '情感树洞', i18nKey: 'plaza.voice.feelings' },
];
