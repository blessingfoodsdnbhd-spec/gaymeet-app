import React from 'react';
import { View, Text, Pressable, FlatList, Modal, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { on as wsOn, emit as wsEmit } from '../../api/ws';
import { tierColor, tierEmoji } from '../../utils/plazaIdentity';
import type { PlazaRoster, PlazaRosterUser } from '../../api/worldChat';

const PANEL_W = 264;

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
  const [roster, setRoster] = React.useState<PlazaRoster | null>(null);

  // Subscribe to roster pushes for this room, THEN request a fresh one — strictly
  // in that order, within ONE effect. The request must go out only after the
  // listener is live: the global lobby ('world') is a backend no-op re-join that
  // triggers no follow-up roster broadcast, so a request racing ahead of the
  // (async) listener registration is lost forever and the drawer stays empty.
  // Sub-rooms happened to recover via their real join's re-broadcast, which is
  // why the 总聊天室 在线名单 looked broken while sub-boards worked. Re-runs on
  // open so the list is fresh each time, and stays live (server re-broadcasts on
  // join/leave) while the drawer is shown.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('world-chat:roster', (r) => {
        if (!cancelled && r.roomId === roomId) setRoster(r as PlazaRoster);
      });
      if (cancelled) {
        u();
        return;
      }
      unsub = u;
      wsEmit('world-chat:request-roster', { roomId });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [open, roomId]);

  return (
    // animationType="none" (NOT "slide"): RN's native slide animation on a
    // transparent + statusBarTranslucent Modal mis-positions the content under
    // Android 15 forced edge-to-edge + Fabric — the panel slid off-screen and the
    // drawer "flew" away (only the backdrop showed). We drive the slide-in with a
    // reanimated translateX instead, exactly mirroring the shared Sheet's proven
    // translateY approach. statusBarTranslucent is still required so the Modal
    // window draws under the status bar like the edge-to-edge host activity.
    <Modal visible={open} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <DrawerSurface
        open={open}
        onClose={onClose}
        users={roster?.users ?? []}
        online={roster?.online ?? roster?.users?.length ?? 0}
        onOpenUser={onOpenUser}
      />
    </Modal>
  );
}

function DrawerSurface({
  open,
  onClose,
  users,
  online,
  onOpenUser,
}: {
  open: boolean;
  onClose: () => void;
  users: PlazaRosterUser[];
  online: number;
  onOpenUser: (userId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const tx = useSharedValue(PANEL_W); // start off-screen to the right
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (open) {
      tx.value = withTiming(0, { duration: 280, easing: Easing.bezier(0.2, 0.7, 0.2, 1) });
      opacity.value = withTiming(1, { duration: 220 });
    } else {
      tx.value = withTiming(PANEL_W, { duration: 200 });
      opacity.value = withTiming(0, { duration: 160 });
    }
  }, [open, tx, opacity]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    // Flex-based root (NOT absolute fill): on Fabric + Android an absolute-fill
    // root view gets a broken hit region and swallows taps to children. Same
    // lesson as the shared Sheet.
    <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.panel, { backgroundColor: theme.colors.surface }, panelStyle]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.text }}>
            {t('plaza.online', { n: online })}
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
      </Animated.View>
    </View>
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
  // Right-anchored drawer. Absolute within the flex root so the reanimated
  // translateX slides it in from the right edge.
  panel: { position: 'absolute', top: 0, bottom: 0, right: 0, width: PANEL_W },
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
