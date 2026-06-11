import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { computeAge, computeZodiac, zodiacLabel } from '../utils/zodiac';
import type { User } from '../api/me';

/** Factual profile attributes rendered as one plain, bullet-separated line
 *  (age · zodiac · height/weight · body · 💕relationship · 🧠mbti · 🎯intent
 *  · city). Replaces the old "stats pills" chip grid — same values, rendered
 *  as wrapping text instead of a grid of rounded pills. Returns null when the
 *  user has filled in nothing. */
export function ProfileStatsText({
  user,
  style,
}: {
  user: User;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const seg: string[] = [];

  // Age + zodiac. Prefer a live age from dob (always fresh); fall back to the
  // stored age for legacy users. Zodiac only when dob is set.
  const age = computeAge(user.dob) ?? user.age;
  if (age != null) {
    const z = computeZodiac(user.dob);
    seg.push(t('about.stats.age', { n: age }) + (z ? ` · ${zodiacLabel(z, i18n.language)}` : ''));
  }
  // Height + weight collapse into one "170 cm / 75 kg" segment (either alone
  // renders cleanly on its own).
  const hw: string[] = [];
  if (user.height) hw.push(`${user.height} cm`);
  if (user.weight) hw.push(`${user.weight} kg`);
  if (hw.length) seg.push(hw.join(' / '));
  if (user.bodyType) seg.push(t(`profile.edit.bodyTypes.${user.bodyType}`));
  if (user.relationshipStatus) {
    const k =
      ({ in_relationship: 'inRelationship', open_relationship: 'openRelationship' } as Record<string, string>)[
        user.relationshipStatus
      ] ?? user.relationshipStatus;
    seg.push(`💕 ${t(`profile.relationshipStatus.${k}`)}`);
  }
  if (user.mbti) seg.push(`🧠 ${user.mbti}`);
  (user.intents ?? []).forEach((i) => seg.push(`🎯 ${t(`profile.intents.${i}`)}`));
  if (user.city) seg.push(user.city);

  if (seg.length === 0) return null;
  return (
    <Text style={[{ fontSize: 14, lineHeight: 22, color: theme.colors.text2 }, style]}>
      {seg.join('  ·  ')}
    </Text>
  );
}
