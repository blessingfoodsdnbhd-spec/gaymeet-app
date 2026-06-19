import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { ChevronLeft, X, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '../../components/Sheet';
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
 * Header shows "在线 N 人"; each row = identity color + emoji + name + level badge,
 * sorted server-side (身份 → 等级 → 加入顺序). Tap a row to open the user.
 *
 * IMPORTANT (vc117): this MUST render inside the shared <Sheet> (a real RN
 * <Modal>), NOT an in-screen absolute-fill overlay. The vc115/116 in-screen
 * version drew correctly but its rows were UNTAPPABLE on Android: (a) an
 * `position:absolute` root gets a broken hit region under Fabric and swallows
 * child touches, and (b) as a mere sibling of the chat it never won touch order
 * against the message list + composer that overlap it — so taps landed on the
 * chat behind, not the roster rows. A <Modal> is a separate window that always
 * wins touch and never overlaps the chat. The settings view stays INLINE (mode
 * switch within this same Modal) so there's no second-Modal handoff race.
 */
export function RoomOnlineSidebar({
  open,
  onClose,
  roomId,
  onOpenUser,
  onOpenSettings,
  settingsContent,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  onOpenUser: (userId: string) => void;
  /** Fallback custom-room settings opener for callers that do not pass inline content. */
  onOpenSettings?: () => void;
  /** Custom rooms only: inline settings content, rendered in the SAME Modal (no handoff). */
  settingsContent?: React.ReactNode;
}) {
  const [roster, setRoster] = React.useState<PlazaRoster | null>(null);
  const [mode, setMode] = React.useState<'roster' | 'settings'>('roster');

  React.useEffect(() => {
    if (open) setMode('roster');
  }, [open, roomId]);

  // Subscribe to roster pushes for this room, THEN request a fresh one — strictly
  // in that order, within ONE effect. The request must go out only after the
  // listener is live: the global lobby ('world') is a backend no-op re-join that
  // triggers no follow-up roster broadcast, so a request racing ahead of the
  // (async) listener registration is lost forever and the drawer stays empty.
  // Re-runs on open so the list is fresh each time, and stays live (server
  // re-broadcasts on join/leave) while the drawer is shown.
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
    <Sheet open={open} onClose={onClose} maxHeight="80%">
      {mode === 'settings' && settingsContent ? (
        <SettingsSheetContent onBack={() => setMode('roster')} onClose={onClose}>
          {settingsContent}
        </SettingsSheetContent>
      ) : (
        <RosterSheetContent
          onClose={onClose}
          users={roster?.users ?? []}
          online={roster?.online ?? roster?.users?.length ?? 0}
          onOpenUser={onOpenUser}
          onOpenSettings={settingsContent ? () => setMode('settings') : onOpenSettings}
        />
      )}
    </Sheet>
  );
}

function SettingsSheetContent({
  onBack,
  onClose,
  children,
}: {
  onBack: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={onBack} hitSlop={8}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: theme.colors.text }}>
          {t('worldChat.rooms.settings')}
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={22} color={theme.colors.muted} />
        </Pressable>
      </View>
      <View style={{ paddingTop: theme.spacing.l }}>{children}</View>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
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
