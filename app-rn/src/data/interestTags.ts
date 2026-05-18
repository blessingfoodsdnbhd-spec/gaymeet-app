/**
 * 16 fixed interest tags shown on the InterestTagsPicker and used across
 * Discover (推荐), Nearby, and Moments filters.
 *
 * IDs are stable strings — they go in the database and on the wire.
 * Treat this as the canonical source of truth; if anything in the design
 * handoff data.jsx disagrees (e.g. it shows "City Walk" while the README
 * shows "城市漫步"), the README wins because it is authoritative.
 */
export type InterestTagId =
  | 'city-walk'
  | 'coffee'
  | 'vinyl'
  | 'film'
  | 'indie-rock'
  | 'bookclub'
  | 'hiking'
  | 'matcha'
  | 'pottery'
  | 'skate'
  | 'cat'
  | 'cooking'
  | 'movie'
  | 'yoga'
  | 'boardgame'
  | 'anime';

export interface InterestTag {
  id: InterestTagId;
  zh: string;
  en: string;
  emoji: string;
}

export const INTEREST_TAGS: InterestTag[] = [
  { id: 'city-walk', zh: '城市漫步', en: 'City Walk', emoji: '🌆' },
  { id: 'coffee', zh: '精品咖啡', en: 'Coffee', emoji: '☕' },
  { id: 'vinyl', zh: '黑胶', en: 'Vinyl', emoji: '💿' },
  { id: 'film', zh: '胶片摄影', en: 'Film', emoji: '📷' },
  { id: 'indie-rock', zh: '独立摇滚', en: 'Indie', emoji: '🎸' },
  { id: 'bookclub', zh: '读书会', en: 'Book Club', emoji: '📖' },
  { id: 'hiking', zh: '徒步', en: 'Hiking', emoji: '🥾' },
  { id: 'matcha', zh: '抹茶研究', en: 'Matcha', emoji: '🍵' },
  { id: 'pottery', zh: '陶艺', en: 'Pottery', emoji: '🏺' },
  { id: 'skate', zh: '滑板', en: 'Skate', emoji: '🛹' },
  { id: 'cat', zh: '猫奴', en: 'Cat', emoji: '🐈' },
  { id: 'cooking', zh: '下厨', en: 'Cooking', emoji: '🍳' },
  { id: 'movie', zh: '影迷', en: 'Cinephile', emoji: '🎬' },
  { id: 'yoga', zh: '瑜伽', en: 'Yoga', emoji: '🧘' },
  { id: 'boardgame', zh: '桌游', en: 'Board Games', emoji: '🎲' },
  { id: 'anime', zh: '动漫', en: 'Anime', emoji: '✨' },
];

export const tagById = (id: string): InterestTag | undefined =>
  INTEREST_TAGS.find((t) => t.id === id);

/** Minimum tags a new user must select to enter the app. */
export const MIN_ONBOARDING_TAGS = 3;
