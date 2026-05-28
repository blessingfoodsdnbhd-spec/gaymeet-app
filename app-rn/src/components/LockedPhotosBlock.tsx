import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/ThemeProvider';
import type { PhotoRequestStatus } from '../api/privatePhotos';

interface Props {
  /** PhotoRequest status, or 'none' when no request has been sent yet. */
  status: PhotoRequestStatus | 'none';
  busy: boolean;
  onRequest: () => void;
}

/**
 * The "Request to view" CTA shown when the requester is NOT yet
 * approved. Five states drive the copy/disabled-ness:
 *   none      → primary CTA ("Request to view")
 *   pending   → disabled chip ("Request sent · pending")
 *   rejected  → muted-tone tappable ("Request denied · Tap to request again")
 *   revoked   → primary CTA with revoked copy ("Previously had access · Request again")
 *   expired   → backend-side state nobody currently writes; treat as none.
 *
 * Approved is intentionally NOT handled here — parents render the
 * actual photos inline above this component when status === 'approved'.
 */
export function LockedPhotosBlock({ status, busy, onRequest }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  // Only pending is hard-disabled — rejected/revoked/none are all
  // tappable (a fresh request creates a new PhotoRequest row, the prior
  // one stays as audit). Rejected gets a muted visual tone so the user
  // still understands the prior denial without it looking like a fresh
  // primary CTA.
  const isDisabled = status === 'pending';
  const isMutedTone = status === 'rejected';
  const label =
    status === 'pending'
      ? t('userDetail.requestSent')
      : status === 'rejected'
      ? t('userDetail.requestRejected')
      : status === 'revoked'
      ? t('userDetail.requestRevoked')
      : t('userDetail.requestToView');

  return (
    <Pressable
      onPress={onRequest}
      disabled={isDisabled || busy}
      style={({ pressed }) => [
        styles.cta,
        {
          backgroundColor:
            isDisabled || isMutedTone
              ? theme.colors.surface2
              : theme.colors.primarySoft,
          borderColor: theme.colors.line,
          opacity: pressed || busy ? 0.7 : 1,
        },
      ]}
    >
      <Lock
        size={18}
        color={isDisabled || isMutedTone ? theme.colors.muted : theme.colors.primaryDeep}
        strokeWidth={1.8}
      />
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color:
            isDisabled || isMutedTone
              ? theme.colors.muted
              : theme.colors.primaryDeep,
        }}
      >
        {label}
      </Text>
      {busy && <ActivityIndicator size="small" color={theme.colors.primaryDeep} />}
    </Pressable>
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
});
