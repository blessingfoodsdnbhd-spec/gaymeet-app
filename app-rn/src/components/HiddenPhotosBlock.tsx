import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/ThemeProvider';
import type { HiddenRequestStatus } from '../api/hiddenPhotos';

interface Props {
  /** Requester's current request status toward this owner. */
  status: HiddenRequestStatus;
  /** How many hidden photos the owner has — drives the frosted teaser tiles. */
  count: number;
  busy: boolean;
  onRequest: () => void;
  /** Force inert (self-preview — can't request your own). */
  disabled?: boolean;
}

/**
 * "🔒 N hidden photos · Request to view" CTA shown when the viewer is NOT
 * granted. States:
 *   none      → primary CTA ("Request to view")
 *   pending   → disabled chip ("Requested")
 *   rejected  → muted tappable ("Request again")
 *   approved  → NOT handled here (parent renders the unlocked photos inline).
 */
export function HiddenPhotosBlock({ status, count, busy, onRequest, disabled }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const isDisabled = disabled || status === 'pending';
  const isMuted = status === 'rejected';
  const label =
    status === 'pending'
      ? t('hiddenPhotos.requested')
      : status === 'rejected'
      ? t('hiddenPhotos.requestAgain')
      : t('hiddenPhotos.requestToView');

  const tiles = Math.min(Math.max(count, 0), 6);

  return (
    <>
      {tiles > 0 && (
        <View style={styles.tilesRow}>
          {Array.from({ length: tiles }).map((_, i) => (
            <View
              key={i}
              style={[styles.tile, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.line }]}
            >
              <Lock size={16} color={theme.colors.muted} strokeWidth={1.8} />
            </View>
          ))}
        </View>
      )}
      <Pressable
        onPress={onRequest}
        disabled={isDisabled || busy}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: isDisabled || isMuted ? theme.colors.surface2 : theme.colors.primarySoft,
            borderColor: theme.colors.line,
            opacity: pressed || busy ? 0.7 : 1,
          },
        ]}
      >
        <Lock
          size={18}
          color={isDisabled || isMuted ? theme.colors.muted : theme.colors.primaryDeep}
          strokeWidth={1.8}
        />
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: isDisabled || isMuted ? theme.colors.muted : theme.colors.primaryDeep,
          }}
        >
          {label}
        </Text>
        {busy && <ActivityIndicator size="small" color={theme.colors.primaryDeep} />}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tilesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tile: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
