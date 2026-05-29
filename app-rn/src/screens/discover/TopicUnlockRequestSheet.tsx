import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';

import { Sheet } from '../../components/Sheet';
import { useTheme } from '../../theme/ThemeProvider';
import { requestUnlock } from '../../api/topicUnlocks';
import { PremiumGateSheet } from '../../components/PremiumGateSheet';

interface Props {
  open: boolean;
  ownerId: string;
  ownerNickname: string;
  onClose: () => void;
}

/**
 * Confirm-and-send sheet for an unlock request. Idempotent: if a row
 * already exists for (me, owner), the backend either bumps requestedAt
 * (reviving pending/rejected/revoked) or returns the existing approved
 * row unchanged.
 *
 * Free users hit a 3-per-rolling-24h cap server-side (402 with reason
 * 'premium_required'); we surface that as a translated alert so PR-E
 * can drop a paywall sheet in here later without changing this file.
 */
export function TopicUnlockRequestSheet({
  open,
  ownerId,
  ownerNickname,
  onClose,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const mut = useMutation({
    mutationFn: () => requestUnlock(ownerId),
    onSuccess: (row) => {
      if (row.status === 'approved') {
        Alert.alert(t('topics.alreadyApproved'));
      } else {
        Alert.alert(t('topics.requestSent'));
      }
      onClose();
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const body = e?.response?.data;
      if (status === 402 && body?.reason === 'premium_required') {
        // Don't dismiss the parent sheet — pop the paywall on top so
        // the user can return here if they cancel the upgrade.
        setPaywallOpen(true);
      } else {
        Alert.alert(
          t('topics.requestFailed'),
          body?.error || e?.message || '',
        );
      }
    },
  });

  return (
    <Sheet open={open} onClose={onClose} maxHeight="48%">
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {t('topics.requestConfirmTitle', { name: ownerNickname })}
      </Text>
      <Text style={[styles.body, { color: theme.colors.text2 }]}>
        {t('topics.requestConfirmBody')}
      </Text>

      <View style={styles.row}>
        <Pressable
          onPress={onClose}
          disabled={mut.isPending}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: theme.colors.surface2,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: theme.colors.text2 }]}>
            {t('common.cancel')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => mut.mutate()}
          disabled={mut.isPending}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: theme.colors.primary,
              opacity: pressed || mut.isPending ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
            {mut.isPending ? '…' : t('topics.send')}
          </Text>
        </Pressable>
      </View>

      <PremiumGateSheet
        open={paywallOpen}
        title={t('topics.requestLimitTitle')}
        body={t('topics.requestLimitBody')}
        onClose={() => setPaywallOpen(false)}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 14, fontWeight: '700' },
});
