import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Shared empty-state: a centered icon + title + optional subtitle, with up to
 * two actionable CTAs. Used across the app's blank screens so an empty list
 * always nudges the user toward something to do (Apple 4.3(b) — keeps the app
 * feeling alive instead of a ghost town).
 */
export function EmptyState({
  emoji,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  retryLabel,
  onRetry,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** When set, renders a subtle "网络错误 · 重试" retry link (for query errors). */
  retryLabel?: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {!!emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {!!subtitle && <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{subtitle}</Text>}
      {(primaryLabel || secondaryLabel) && (
        <View style={styles.actions}>
          {!!primaryLabel && onPrimary && <Button label={primaryLabel} onPress={onPrimary} />}
          {!!secondaryLabel && onSecondary && <Button label={secondaryLabel} variant="soft" onPress={onSecondary} />}
        </View>
      )}
      {!!retryLabel && onRetry && (
        <Pressable onPress={onRetry} hitSlop={8} style={{ marginTop: 18 }}>
          <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '700' }}>{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  emoji: { fontSize: 44, marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  actions: { marginTop: 22, gap: 10, alignSelf: 'stretch' },
});
