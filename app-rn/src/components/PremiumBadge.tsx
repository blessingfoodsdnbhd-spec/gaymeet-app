import React from 'react';
import { Image } from 'expo-image';

// Dedicated asset name so it doesn't collide with WelcomeScreen's logo.jpg on
// Android (both flatten to the resource name `src_assets_logo` → mergeResources fails).
const MEYOU_MARK = require('../assets/m-mark.png');

/**
 * Premium identity badge (SSSSS) — the small Meyou "M" mark shown next to an
 * active Premium member's name. Renders nothing when the user is not Premium.
 */
export function PremiumBadge({
  isPremium,
  size = 18,
}: {
  isPremium?: boolean | null;
  size?: number;
}) {
  if (!isPremium) return null;
  return (
    <Image
      source={MEYOU_MARK}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
      contentFit="cover"
      accessibilityLabel="Premium"
    />
  );
}
