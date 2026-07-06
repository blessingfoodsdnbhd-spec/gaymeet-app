import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Check, Lock, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { Avatar } from '../components/Avatar';
import { NameWithBadge } from '../components/NameWithBadge';
import { useAuth } from '../store/auth';
import { showToast } from '../utils/toastBridge';
import { PALETTE, DEFAULT_HEX, isUnlocked, gradientFor } from '../utils/roomColors';
import {
  getChatRoom,
  getRoomMembers,
  updateChatRoom,
  kickRoomMember,
  closeChatRoom,
  reopenChatRoom,
  type RoomMember,
} from '../api/worldChat';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'EditRoom'>;

const NAME_MAX = 30;

/**
 * v3.1.11 — full-screen 编辑房间 (creator only), the 4 owner functions that used
 * to live in the deleted roster sheet's 房间设置 row: rename, recolor, member
 * management (kick), and close/reopen. EVERYTHING is inline or a native
 * Alert.alert — NO RN Modal/Sheet (the colors are a horizontal swatch row, the
 * member list is mapped inline, kick/close confirm via Alert).
 */
export function EditRoomScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const { roomId } = useRoute<Rt>().params;
  const me = useAuth((s) => s.user);
  const myId = String((me as any)?.id ?? (me as any)?._id ?? '');
  const myLevel = (me as any)?.level ?? 1;

  const roomQ = useQuery({
    queryKey: ['worldChat', 'room', roomId],
    queryFn: () => getChatRoom(roomId),
    staleTime: 15_000,
    select: (d) => d.room,
  });
  const room = roomQ.data;

  const membersQ = useQuery({
    queryKey: ['worldChat', 'roomMembers', roomId],
    queryFn: () => getRoomMembers(roomId),
    staleTime: 15_000,
    select: (d) => d.members,
  });

  // ── a. rename ──────────────────────────────────────────────────────────────
  const [name, setName] = React.useState('');
  const [savingName, setSavingName] = React.useState(false);
  React.useEffect(() => {
    if (room?.title != null) setName((prev) => (prev === '' ? room.title : prev));
  }, [room?.title]);

  const onSaveName = async () => {
    const ttl = name.trim();
    if (ttl.length < 1) return;
    setSavingName(true);
    try {
      await updateChatRoom(roomId, { title: ttl });
      qc.invalidateQueries({ queryKey: ['worldChat', 'room', roomId] });
      qc.invalidateQueries({ queryKey: ['worldChat', 'rooms'] });
      qc.invalidateQueries({ queryKey: ['worldChat', 'myRooms'] });
      showToast(t('editRoom.nameSaved'), 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? t('editRoom.saveFailed'), 'error');
    } finally {
      setSavingName(false);
    }
  };

  // ── b. color (tap a swatch → save immediately, with live preview) ───────────
  const [color, setColor] = React.useState<string>(DEFAULT_HEX);
  React.useEffect(() => {
    if (room?.cardColor) setColor(room.cardColor);
  }, [room?.cardColor]);

  const onPickColor = async (hex: string) => {
    const prev = color;
    setColor(hex); // optimistic preview
    try {
      await updateChatRoom(roomId, { cardColor: hex });
      qc.invalidateQueries({ queryKey: ['worldChat', 'room', roomId] });
      qc.invalidateQueries({ queryKey: ['worldChat', 'rooms'] });
      showToast(t('editRoom.colorSaved'), 'success');
    } catch (e: any) {
      setColor(prev); // revert
      showToast(e?.response?.data?.error ?? t('editRoom.saveFailed'), 'error');
    }
  };

  // ── c. kick member ──────────────────────────────────────────────────────────
  const onKick = (m: RoomMember) => {
    Alert.alert(
      t('editRoom.kickTitle', { name: m.displayName }),
      t('editRoom.kickBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('editRoom.kickCta'),
          style: 'destructive',
          onPress: async () => {
            try {
              await kickRoomMember(roomId, m.id);
              qc.invalidateQueries({ queryKey: ['worldChat', 'roomMembers', roomId] });
              showToast(t('editRoom.kicked', { name: m.displayName }), 'success');
            } catch (e: any) {
              showToast(e?.response?.data?.error ?? t('editRoom.saveFailed'), 'error');
            }
          },
        },
      ],
    );
  };

  // ── d. close / reopen ────────────────────────────────────────────────────────
  const isClosed = room?.status === 'closed';
  const onToggleClose = () => {
    if (isClosed) {
      Alert.alert(t('editRoom.reopenTitle'), t('editRoom.reopenBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('editRoom.reopenCta'),
          onPress: async () => {
            try {
              await reopenChatRoom(roomId);
              qc.invalidateQueries({ queryKey: ['worldChat', 'room', roomId] });
              showToast(t('editRoom.reopened'), 'success');
            } catch (e: any) {
              showToast(e?.response?.data?.error ?? t('editRoom.saveFailed'), 'error');
            }
          },
        },
      ]);
      return;
    }
    Alert.alert(t('editRoom.closeTitle'), t('editRoom.closeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('editRoom.closeCta'),
        style: 'destructive',
        onPress: async () => {
          try {
            await closeChatRoom(roomId);
            qc.invalidateQueries({ queryKey: ['worldChat', 'room', roomId] });
            qc.invalidateQueries({ queryKey: ['worldChat', 'rooms'] });
            showToast(t('editRoom.closed'), 'success');
            nav.goBack();
          } catch (e: any) {
            showToast(e?.response?.data?.error ?? t('editRoom.saveFailed'), 'error');
          }
        },
      },
    ]);
  };

  const input = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
  } as const;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.text2, letterSpacing: 0.3 }}>{title}</Text>
      {children}
    </View>
  );

  const members = membersQ.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{t('editRoom.title')}</Text>
        {/* accent dot reflects the live colour selection */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, borderWidth: 1, borderColor: theme.colors.line }} />
        </View>
      </View>

      {roomQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: 28 }} keyboardShouldPersistTaps="handled">
          {/* a. rename */}
          <Section title={t('editRoom.nameSection')}>
            <TextInput
              value={name}
              onChangeText={(x) => setName(x.slice(0, NAME_MAX))}
              placeholder={t('editRoom.namePh')}
              placeholderTextColor={theme.colors.muted}
              style={input}
            />
            <Pressable
              onPress={onSaveName}
              disabled={savingName || name.trim().length < 1}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: name.trim().length >= 1 ? theme.colors.primary : theme.colors.line, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={{ color: name.trim().length >= 1 ? '#FFFFFF' : theme.colors.muted, fontWeight: '800', fontSize: 14.5 }}>
                {savingName ? t('editRoom.saving') : t('editRoom.saveName')}
              </Text>
            </Pressable>
          </Section>

          {/* b. color — horizontal swatch row (NOT a popup palette) */}
          <Section title={t('editRoom.colorSection')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 2 }}>
              {PALETTE.map((c) => {
                const unlocked = isUnlocked(c.hex, myLevel);
                const selected = color.toUpperCase() === c.hex.toUpperCase();
                const grad = gradientFor(c.hex);
                return (
                  <Pressable key={c.hex} disabled={!unlocked} onPress={() => onPickColor(c.hex)} style={{ alignItems: 'center', width: 48 }}>
                    <View style={[styles.swatch, { borderColor: selected ? theme.colors.primary : theme.colors.line, borderWidth: selected ? 3 : 1, opacity: unlocked ? 1 : 0.35 }]}>
                      {grad ? (
                        <LinearGradient colors={grad as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c.hex }]} />
                      )}
                      {selected && unlocked && <View style={styles.swatchCenter}><Check size={18} color="#000000" strokeWidth={3} /></View>}
                      {!unlocked && <View style={styles.swatchCenter}><Lock size={14} color="#000000" /></View>}
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.muted, marginTop: 4 }}>
                      {unlocked ? `Lv${c.level}` : `🔒Lv${c.level}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>

          {/* c. members — mapped inline (no nested FlatList) */}
          <Section title={t('editRoom.membersSection', { n: members.length })}>
            {membersQ.isLoading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              members.map((m) => {
                const self = m.id === myId;
                return (
                  <View key={m.id} style={styles.memberRow}>
                    <Avatar name={m.displayName || '?'} uri={m.avatarUrl} size={40} />
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <NameWithBadge
                        name={m.displayName}
                        official={m.isOfficial}
                        verified={m.isVerified}
                        premium={m.isPremium}
                        badgeSize={14}
                        containerStyle={{ flexShrink: 1 }}
                        textStyle={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}
                      />
                      {m.isCreator && <Crown size={14} color={theme.colors.primary} strokeWidth={2.5} />}
                    </View>
                    {!self && !m.isCreator && (
                      <Pressable onPress={() => onKick(m)} hitSlop={6} style={({ pressed }) => [styles.kickBtn, { borderColor: theme.colors.error, opacity: pressed ? 0.6 : 1 }]}>
                        <Text style={{ color: theme.colors.error, fontWeight: '800', fontSize: 13 }}>{t('editRoom.kick')}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </Section>

          {/* d. close / reopen */}
          <Section title={t('editRoom.statusSection')}>
            <Text style={{ fontSize: 12.5, color: theme.colors.muted, lineHeight: 18 }}>{t('editRoom.closeHint')}</Text>
            <Pressable
              onPress={onToggleClose}
              style={({ pressed }) => [
                styles.statusBtn,
                { backgroundColor: isClosed ? theme.colors.success : theme.colors.warning, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14.5 }}>
                {isClosed ? t('editRoom.reopenCta') : t('editRoom.closeCta')}
              </Text>
            </Pressable>
          </Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 48, height: 48, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  swatchCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  kickBtn: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  statusBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
