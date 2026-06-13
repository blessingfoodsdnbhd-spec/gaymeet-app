import React from 'react';
import { View, Text, Pressable, FlatList, Modal, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { on as wsOn, emit as wsEmit } from '../../api/ws';
import { tierColor, tierEmoji } from '../../utils/plazaIdentity';
import type { PlazaRoster, PlazaRosterUser } from '../../api/worldChat';

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * mIRC 在线名单 (spec §9.1) — the room's live online roster. On desktop it's a
 * fixed 240px right sidebar; on mobile (this app) it slides in as a right drawer
 * from a header icon. Header shows "在线 N 人"; each row = identity color + emoji
 * + name + level badge, sorted server-side (身份 → 等级 → 加入顺序). Tap a row to
 * open the user (profile / DM).
 */
export function RoomOnlineSidebar({
  open,
  onClose,
  roomId,
  onOpenUser,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  onOpenUser: (userId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [roster, setRoster] = React.useState<PlazaRoster | null>(null);

  // Subscribe to roster pushes for this room; the server also re-broadcasts on
  // every join/leave, so the list stays live while the drawer is open.
  React.useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('world-chat:roster', (r) => {
        if (!cancelled && r.roomId === roomId) setRoster(r as PlazaRoster);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [roomId]);

  // Ask for a fresh roster whenever the drawer opens.
  React.useEffect(() => {
    if (open) wsEmit('world-chat:request-roster', { roomId });
  }, [open, roomId]);

  const users = roster?.users ?? [];

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.panel, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.text }}>
              {t('plaza.online', { n: roster?.online ?? users.length })}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={theme.colors.muted} />
            </Pressable>
          </View>
          <FlatList
            data={users}
            keyExtractor={(u) => u.userId}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => <RosterRow user={item} onPress={() => onOpenUser(item.userId)} />}
            ListEmptyComponent={
              <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                {t('plaza.online', { n: 0 })}
              </Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

function RosterRow({ user, onPress }: { user: PlazaRosterUser; onPress: () => void }) {
  const theme = useTheme();
  const color = tierColor(theme, user.tier);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Avatar name={user.name || '?'} uri={user.avatarUrl} avatarIdx={idxFor(user.userId)} size={32} />
      <Text style={{ fontSize: 13 }}>{tierEmoji(user.tier)}</Text>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color }}>
        {user.name}
      </Text>
      <View style={[styles.lvl, { borderColor: color }]}>
        <Text style={{ fontSize: 10.5, fontWeight: '800', color }}>Lv{user.level}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: { width: 264, height: '100%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 8 },
  lvl: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
});
