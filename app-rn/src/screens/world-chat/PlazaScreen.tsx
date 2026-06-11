import React from 'react';
import { WorldChatScreen } from './WorldChatScreen';

/**
 * 广场 tab landing — the World Lobby first (mIRC-style): real-time global chat,
 * a 🔥 hot-rooms strip, and a room drawer. Thin wrapper so the same screen
 * powers both the tab (lobby mode) and the pushed single-room view.
 */
export function PlazaScreen() {
  return <WorldChatScreen lobby />;
}
