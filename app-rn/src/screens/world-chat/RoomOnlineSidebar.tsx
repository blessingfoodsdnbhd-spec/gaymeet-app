import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { X, Settings } from 'lucide-react-native';
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
 * fixed 240px right sidebar; on mobile (this app) it opens as a bottom sheet.
 * Header shows "在线 N 人"; each row = identity color + emoji
 * + name + level badge, sorted server-side (身份 → 等级 → 加入顺序). Tap a row to
 * open the user (profile / DM).
 */
export function RoomOnlineSidebar({
  open,
  onClose,
  roomId,
  onOpenUser,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  onOpenUser: (userId: string) => void;
  /** Custom rooms only: opens RoomSettingsSheet (relocated header ⋮). */
  onOpenSettings?: () => void;
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

  if (!open) return null;

  return (
    <RosterModalSurface onClose={onClose}>
      <RosterSheetContent
        onClose={onClose}
        users={roster?.users ?? []}
        online={roster?.online ?? roster?.users?.length ?? 0}
        onOpenUser={onOpenUser}
        onOpenSettings={onOpenSettings}
      />
    </RosterModalSurface>
  );
}

function RosterModalSurface({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.modalRoot} pointerEvents="box-none">
      <View style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="none" />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xxl,
            borderTopRightRadius: theme.radius.xxl,
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.l,
            paddingBottom: theme.spacing.xxxl,
          },
          theme.shadows.pop,
        ]}
      >
        <View
          style={[
            styles.grabber,
            {
              backgroundColor: theme.colors.line,
              width: theme.spacing.xxxl + theme.spacing.xs,
              height: theme.spacing.xs,
              borderRadius: theme.radius.s,
              marginBottom: theme.spacing.m,
            },
          ]}
        />
        {children}
      </View>
    </View>
  );
}

function RosterSheetContent({
  onClose,
  users,
  online,
  onOpenUser,
  onOpenSettings,
}: {
  onClose: () => void;
  users: PlazaRosterUser[];
  online: number;
  onOpenUser: (userId: string) => void;
  onOpenSettings?: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();

  return (
    <View>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text }}>
          {t('plaza.online', { n: online })}
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={22} color={theme.colors.muted} />
        </Pressable>
      </View>
      {onOpenSettings && (
        <Pressable
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.settingsRow, { borderBottomColor: theme.colors.line, opacity: pressed ? 0.6 : 1 }]}
        >
          <Settings size={18} color={theme.colors.text} />
          <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: theme.colors.text }}>
            {t('worldChat.rooms.settings')}
          </Text>
        </Pressable>
      )}
      <FlatList
        data={users}
        keyExtractor={(u) => u.userId}
        style={{ maxHeight: Math.round(height * 0.56) }}
        contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item }) => <RosterRow user={item} onPress={() => onOpenUser(item.userId)} />}
        ListEmptyComponent={
          <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 24, fontSize: 13 }}>
            {t('plaza.online', { n: 0 })}
          </Text>
        }
      />
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
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    backgroundColor: 'rgba(30,15,5,0.35)',
    zIndex: 0,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '78%',
    zIndex: 1,
    elevation: 1001,
  },
  grabber: {
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 8 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lvl: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
});
