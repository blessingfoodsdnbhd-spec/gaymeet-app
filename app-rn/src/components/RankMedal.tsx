import { Image as ExpoImage } from 'expo-image';

/**
 * Branded 3D rank medals (gold "1" / silver "2" / bronze "3") that replace the
 * flat 🥇🥈🥉 emoji wherever a vote rank is shown. Ranks > 3 render nothing — the
 * caller keeps a `#N` text fallback (see `medalFor` in screens/votes/voteHelpers).
 *
 * The three PNGs share one 238×347 canvas with discs equal-sized and bottom-aligned,
 * so a single `aspectRatio` keeps them consistent. `size` is the rendered width.
 */
const MEDALS = {
  1: require('../assets/medal-gold.png'),
  2: require('../assets/medal-silver.png'),
  3: require('../assets/medal-bronze.png'),
} as const;

const ASPECT = 238 / 347; // shared canvas (width / height)

export function RankMedal({ rank, size = 30 }: { rank: number; size?: number }) {
  const src = MEDALS[rank as 1 | 2 | 3];
  if (!src) return null;
  return <ExpoImage source={src} style={{ width: size, aspectRatio: ASPECT }} contentFit="contain" />;
}
