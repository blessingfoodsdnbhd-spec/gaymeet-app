/**
 * Interest tags shown on the InterestTagsPicker and used across Discover
 * (推荐), Nearby, and Moments filters.
 *
 * IDs are stable strings — they go in the database and on the wire.
 * Treat this as the canonical source of truth; if anything in the design
 * handoff data.jsx disagrees (e.g. it shows "City Walk" while the README
 * shows "城市漫步"), the README wins because it is authoritative.
 *
 * The first 16 are the original launch set; the rest were added later to
 * broaden matching across sports / food / culture / outdoors / travel /
 * work / lifestyle / nightlife. Backend VALID_TAG_IDS in
 * backend-express/src/routes/interests.js must stay in sync.
 */
export type InterestTagId =
  // Original 16
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
  | 'anime'
  // Sports
  | 'fitness'
  | 'swimming'
  | 'running'
  | 'cycling'
  | 'basketball'
  // Food & drink
  | 'hotpot'
  | 'japanese-food'
  | 'dessert'
  | 'wine'
  | 'whisky'
  | 'cocktails'
  // Culture
  | 'exhibitions'
  | 'jazz'
  | 'kpop'
  // Outdoors
  | 'camping'
  | 'diving'
  | 'skiing'
  | 'climbing'
  | 'surfing'
  // Travel
  | 'backpacking'
  | 'islands'
  // Work & craft
  | 'startup'
  | 'investing'
  | 'coding'
  | 'design'
  // Lifestyle
  | 'dogs'
  | 'gardening'
  | 'baking'
  | 'fashion'
  // Nightlife
  | 'clubbing'
  | 'bars'
  | 'ktv';

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
  // Sports
  { id: 'fitness', zh: '健身', en: 'Fitness', emoji: '💪' },
  { id: 'swimming', zh: '游泳', en: 'Swimming', emoji: '🏊' },
  { id: 'running', zh: '跑步', en: 'Running', emoji: '🏃' },
  { id: 'cycling', zh: '骑行', en: 'Cycling', emoji: '🚴' },
  { id: 'basketball', zh: '篮球', en: 'Basketball', emoji: '🏀' },
  // Food & drink
  { id: 'hotpot', zh: '火锅', en: 'Hotpot', emoji: '🍲' },
  { id: 'japanese-food', zh: '日料', en: 'Japanese Food', emoji: '🍣' },
  { id: 'dessert', zh: '甜品', en: 'Dessert', emoji: '🍰' },
  { id: 'wine', zh: '葡萄酒', en: 'Wine', emoji: '🍷' },
  { id: 'whisky', zh: '威士忌', en: 'Whisky', emoji: '🥃' },
  { id: 'cocktails', zh: '调酒', en: 'Cocktails', emoji: '🍸' },
  // Culture
  { id: 'exhibitions', zh: '看展', en: 'Exhibitions', emoji: '🖼️' },
  { id: 'jazz', zh: '爵士', en: 'Jazz', emoji: '🎷' },
  { id: 'kpop', zh: 'K-pop', en: 'K-pop', emoji: '🎤' },
  // Outdoors
  { id: 'camping', zh: '露营', en: 'Camping', emoji: '🏕️' },
  { id: 'diving', zh: '潜水', en: 'Diving', emoji: '🤿' },
  { id: 'skiing', zh: '滑雪', en: 'Skiing', emoji: '🎿' },
  { id: 'climbing', zh: '攀岩', en: 'Climbing', emoji: '🧗' },
  { id: 'surfing', zh: '冲浪', en: 'Surfing', emoji: '🏄' },
  // Travel
  { id: 'backpacking', zh: '背包客', en: 'Backpacking', emoji: '🎒' },
  { id: 'islands', zh: '海岛', en: 'Islands', emoji: '🏝️' },
  // Work & craft
  { id: 'startup', zh: '创业', en: 'Startup', emoji: '🚀' },
  { id: 'investing', zh: '投资', en: 'Investing', emoji: '📈' },
  { id: 'coding', zh: '程序员', en: 'Coding', emoji: '💻' },
  { id: 'design', zh: '设计师', en: 'Design', emoji: '🎨' },
  // Lifestyle
  { id: 'dogs', zh: '养狗', en: 'Dogs', emoji: '🐶' },
  { id: 'gardening', zh: '园艺', en: 'Gardening', emoji: '🌱' },
  { id: 'baking', zh: '烘焙', en: 'Baking', emoji: '🧁' },
  { id: 'fashion', zh: '时尚', en: 'Fashion', emoji: '👗' },
  // Nightlife
  { id: 'clubbing', zh: 'Clubbing', en: 'Clubbing', emoji: '🪩' },
  { id: 'bars', zh: '酒吧', en: 'Bars', emoji: '🍺' },
  { id: 'ktv', zh: 'KTV', en: 'KTV', emoji: '🎶' },
];

export const tagById = (id: string): InterestTag | undefined =>
  INTEREST_TAGS.find((t) => t.id === id);

/** Minimum tags a new user must select to enter the app. */
export const MIN_ONBOARDING_TAGS = 3;
