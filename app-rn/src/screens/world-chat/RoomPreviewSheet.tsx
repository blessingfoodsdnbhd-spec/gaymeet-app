import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { getRoomPreview } from '../../lib/roomPreviewCache';
import type { WorldChatMessage } from '../../api/worldChat';

/**
 * Long-press preview of a room: title + last ~5 messages (30s in-memory cache).
 * A centered fade card (Android edge-to-edge safe — not a slide Modal). "Enter"
 * jumps into the room; tapping the backdrop dismisses.
 */
export function RoomPreviewSheet({
  roomId,
  title,
  onEnter,
  onClose,
}: {
  roomId: string;
  title: string;
  onEnter: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);

  useEffect(() => {
    let alive = true;
    getRoomPreview(roomId)
      .then((m) => alive && setMessages(m.slice(0, 5)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [roomId]);

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xxl }]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.sub, { color: theme.colors.muted }]}>{t('plaza.preview.lastMessages')}</Text>

          <View style={{ marginTop: 12, minHeight: 60 }}>
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />
            ) : messages.length === 0 ? (
              <Text style={{ color: theme.colors.muted, fontSize: 13, textAlign: 'center', marginVertical: 16 }}>
                {t('plaza.preview.noMessages')}
              </Text>
            ) : (
              messages.map((m) => (
                <View key={m.messageId} style={styles.msgRow}>
                  <Text style={[styles.msgName, { color: theme.colors.primaryDeep }]} numberOfLines={1}>
                    {m.displayName}
                  </Text>
                  <Text style={[styles.msgBody, { color: theme.colors.text2 }]} numberOfLines={1}>
                    {m.type === 'photo' ? '📷' : m.type === 'voice' ? '🎤' : m.body}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Pressable
            onPress={onEnter}
            style={({ pressed }) => [
              styles.enterBtn,
              { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{t('plaza.preview.enter')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card: { width: '100%', maxWidth: 380, padding: 22 },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  msgRow: { flexDirection: 'row', gap: 8, paddingVertical: 5 },
  msgName: { fontSize: 13, fontWeight: '700', maxWidth: 110 },
  msgBody: { fontSize: 13, flex: 1 },
  enterBtn: { marginTop: 18, paddingVertical: 13, alignItems: 'center' },
});
