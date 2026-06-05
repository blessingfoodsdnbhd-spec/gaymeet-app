/**
 * Per-room compose-input placeholders. App labels stay in the user's selected
 * language; only this placeholder is localized to the ROOM's primary language
 * for a small cultural touch on entering a country room. Falls back to 'world'.
 */
const PLACEHOLDERS: Record<string, { zh: string; en: string }> = {
  world: { zh: '和世界聊聊…', en: 'Chat with the world…' },
  MY: { zh: 'Sembang dengan kawan-kawan…', en: 'Sembang dengan kawan-kawan…' },
  CN: { zh: '和大家聊聊…', en: '和大家聊聊…' },
  KR: { zh: '한국 친구들과 채팅…', en: '한국 친구들과 채팅…' },
  JP: { zh: '日本の友達とチャット…', en: '日本の友達とチャット…' },
  TW: { zh: '和台灣的朋友聊聊…', en: '和台灣的朋友聊聊…' },
  HK: { zh: '同香港朋友傾下偈…', en: '同香港朋友傾下偈…' },
  US: { zh: 'Chat with people in the US…', en: 'Chat with people in the US…' },
  TH: { zh: 'แชทกับเพื่อนๆ…', en: 'แชทกับเพื่อนๆ…' },
  VN: { zh: 'Trò chuyện với mọi người…', en: 'Trò chuyện với mọi người…' },
  SG: { zh: 'Chat with people in Singapore…', en: 'Chat with people in Singapore…' },
  ID: { zh: 'Ngobrol dengan teman-teman…', en: 'Ngobrol dengan teman-teman…' },
  PH: { zh: 'Makipag-chat sa mga kaibigan…', en: 'Makipag-chat sa mga kaibigan…' },
  GB: { zh: 'Chat with people in the UK…', en: 'Chat with people in the UK…' },
  AU: { zh: 'Chat with people in Australia…', en: 'Chat with people in Australia…' },
};

export function nativePlaceholder(roomId: string, lang: string): string {
  const e = PLACEHOLDERS[roomId] ?? PLACEHOLDERS.world;
  return lang.startsWith('zh') ? e.zh : e.en;
}
