import type { VoteCategory } from '../../api/votes';

export const VOTE_CATEGORIES: { key: VoteCategory; emoji: string }[] = [
  { key: 'photography', emoji: '📷' },
  { key: 'outfit', emoji: '👗' },
  { key: 'food', emoji: '🍜' },
  { key: 'travel', emoji: '✈️' },
  { key: 'talent', emoji: '🎤' },
  { key: 'pets', emoji: '🐾' },
];

export const categoryEmoji = (c: VoteCategory) =>
  VOTE_CATEGORIES.find((x) => x.key === c)?.emoji ?? '🏷️';

export const medalFor = (rank: number) => ['🥇', '🥈', '🥉'][rank - 1] ?? `#${rank}`;

/** Time-left breakdown for a countdown. `ended` once we pass `endIso`. */
export function timeRemaining(endIso: string): { ended: boolean; d: number; h: number; m: number } {
  const ms = new Date(endIso).getTime() - Date.now();
  if (ms <= 0) return { ended: true, d: 0, h: 0, m: 0 };
  const m = Math.floor(ms / 60000);
  return { ended: false, d: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60), m: m % 60 };
}
