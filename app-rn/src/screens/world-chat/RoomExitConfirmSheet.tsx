import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BellRing, LogOut } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';

/**
 * 离开房间二次确认 (Build 102 §B). Triggered when a non-owner backs out of a
 * custom room. Three choices:
 *   - 保留 (继续接收通知) — stay subscribed in 我在的房间, keep getting pushes.
 *   - 离开 — fully unsubscribe + leave the room.
 *   - 取消 — stay in the room.
 */
export function RoomExitConfirmSheet({
  open,
  roomTitle,
  onKeep,
  onLeave,
  onCancel,
}: {
  open: boolean;
  roomTitle?: string;
  onKeep: () => void;
  onLeave: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Sheet open={open} onClose={onCancel} maxHeight="60%">
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('plaza.exit.title')}</Text>
        <Text style={[styles.body, { color: theme.colors.text2 }]} numberOfLines={2}>
          {roomTitle ? t('plaza.exit.bodyNamed', { title: roomTitle }) : t('plaza.exit.body')}
        </Text>

        <Button
          label={t('plaza.exit.keep')}
          onPress={onKeep}
          leadingIcon={<BellRing size={18} color="#fff" />}
          fullWidth
          style={{ marginTop: 18 }}
        />
        <Button
          label={t('plaza.exit.leave')}
          onPress={onLeave}
          variant="soft"
          leadingIcon={<LogOut size={18} color={theme.colors.error} />}
          textStyle={{ color: theme.colors.error }}
          style={{ marginTop: 10 }}
          fullWidth
        />
        <Button label={t('common.cancel')} onPress={onCancel} variant="ghost" style={{ marginTop: 10 }} fullWidth />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
});
