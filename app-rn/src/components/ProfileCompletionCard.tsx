import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ProgressBar } from './ProgressBar';
import { useTheme } from '../theme/ThemeProvider';
import type { User } from '../api/me';

export interface CompletionItem {
  key: string;
  label: string;
  done: boolean;
  weight: number;
}

export interface ProfileCompletion {
  percent: number;
  items: CompletionItem[];
  missing: CompletionItem[];
  missingCount: number;
}

/**
 * Profile completion score (0–100). Weights:
 *   photos ≥1 (20) · voice intro (15) · interests ≥3 (15) ·
 *   demographic ≥3 of dob/mbti/relationship/intents (20) ·
 *   prompts ≥1 (15) · bio ≥10 chars (15).
 */
export function useProfileCompletion(user: User | null): ProfileCompletion {
  const { t } = useTranslation();
  const photos = user?.photos?.length ?? 0;
  const demoCount = [
    user?.dob,
    user?.mbti,
    user?.relationshipStatus,
    (user?.intents?.length ?? 0) > 0 ? 'x' : null,
  ].filter(Boolean).length;
  const prompts = (user?.prompts ?? []).filter((p) => p?.q && p?.a).length;
  const bio = (user?.bio ?? '').trim();
  const interests = user?.interests?.length ?? 0;

  const items: CompletionItem[] = [
    { key: 'photos', label: t('profile.completion.items.photos'), done: photos >= 1, weight: 20 },
    { key: 'voice', label: t('profile.completion.items.voice'), done: !!user?.voiceIntroUrl, weight: 15 },
    { key: 'interests', label: t('profile.completion.items.interests'), done: interests >= 3, weight: 15 },
    { key: 'demographic', label: t('profile.completion.items.demographic'), done: demoCount >= 3, weight: 20 },
    { key: 'prompts', label: t('profile.completion.items.prompts'), done: prompts >= 1, weight: 15 },
    { key: 'bio', label: t('profile.completion.items.bio'), done: bio.length >= 10, weight: 15 },
  ];
  const percent = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  const missing = items.filter((i) => !i.done);
  return { percent, items, missing, missingCount: missing.length };
}

/** Top-of-Profile card showing completion %, a gradient bar, and an
 *  expandable checklist. Renders nothing once the profile is 100% complete. */
export function ProfileCompletionCard({ user }: { user: User | null }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { percent, items, missingCount } = useProfileCompletion(user);
  const [expanded, setExpanded] = React.useState(false);

  if (percent >= 100) return null;

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.completion.title', { n: percent })}</Text>
        {expanded ? <ChevronUp size={18} color={theme.colors.muted} /> : <ChevronDown size={18} color={theme.colors.muted} />}
      </View>
      <View style={{ marginTop: 10 }}>
        <ProgressBar pct={percent} />
      </View>
      <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
        {t('profile.completion.subtitle', { n: missingCount })}
      </Text>

      {expanded && (
        <View style={{ marginTop: 12, gap: 9 }}>
          {items.map((it) => (
            <View key={it.key} style={styles.itemRow}>
              <View
                style={[
                  styles.bullet,
                  {
                    backgroundColor: it.done ? theme.colors.primary : 'transparent',
                    borderColor: it.done ? theme.colors.primary : theme.colors.line,
                  },
                ]}
              >
                {it.done && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={{ flex: 1, fontSize: 13.5, color: it.done ? theme.colors.muted : theme.colors.text }}>
                {it.label}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.muted, fontWeight: '700' }}>+{it.weight}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 12.5, marginTop: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bullet: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
