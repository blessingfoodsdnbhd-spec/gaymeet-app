import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { X, UserPlus, Crown, ChevronLeft, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { NameWithBadge } from '../../components/NameWithBadge';
import { useTheme } from '../../theme/ThemeProvider';
import {
  getRoomMembers,
  getInvitableFriends,
  updateChatRoom,
  kickRoomMember,
  inviteToRoom,
  closeChatRoom,
  deleteChatRoom,
  leaveChatRoom,
  type ChatRoomSummary,
} from '../../api/worldChat';

export function RoomSettingsSheet({
  open,
  onClose,
  room,
  onChanged,
  onExit,
  initialTab = 'main',
}: {
  open: boolean;
  onClose: () => void;
  room: ChatRoomSummary;
  onChanged: () => void;
  onExit: () => void;
  initialTab?: 'main' | 'invite';
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const { height: screenH } = useWindowDimensions();
  const scrollMaxH = Math.round(screenH * 0.52);

  const [tab, setTab] = React.useState<'main' | 'invite' | 'members'>('main');
  const [title, setTitle] = React.useState(room.title);
  const [description, setDescription] = React.useState(room.description);
  const [isPrivate, setIsPrivate] = React.useState(room.isPrivate);
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  // Reset local state each time the sheet (re)opens for a room.
  React.useEffect(() => {
    if (open) {
      setTab(initialTab);
      setTitle(room.title);
      setDescription(room.description);
      setIsPrivate(room.isPrivate);
      setPassword('');
      setPicked(new Set());
    }
  }, [open, room.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const membersQ = useQuery({
    queryKey: ['worldChat', 'roomMembers', room.id],
    queryFn: () => getRoomMembers(room.id),
    enabled: open && ((room.isCreator && tab === 'main') || tab === 'members'),
    select: (d) => d.members,
  });
  const friendsQ = useQuery({
    queryKey: ['worldChat', 'invitable', room.id],
    queryFn: () => getInvitableFriends(room.id),
    enabled: open && tab === 'invite', // any member can invite, not just the creator
    select: (d) => d.friends,
  });

  const input = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
    color: theme.colors.text,
  } as const;

  const onSaveMeta = async () => {
    if (!title.trim() || busy) return;
    if (isPrivate && !room.isPrivate && !password.trim()) {
      Alert.alert(t('worldChat.rooms.passwordRequired'));
      return;
    }
    setBusy(true);
    try {
      await updateChatRoom(room.id, {
        title: title.trim(),
        description: description.trim(),
        isPrivate,
        password: isPrivate && password.trim() ? password.trim() : undefined,
      });
      onChanged();
      Alert.alert(t('worldChat.rooms.saved'));
    } catch (e: any) {
      Alert.alert(t('worldChat.rooms.saveFailed'), e?.response?.data?.error ?? '');
    } finally {
      setBusy(false);
    }
  };

  const onKick = (userId: string, name: string) =>
    Alert.alert(t('worldChat.rooms.kickConfirmTitle'), t('worldChat.rooms.kickConfirmBody', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('worldChat.rooms.kick'),
        style: 'destructive',
        onPress: async () => {
          try {
            await kickRoomMember(room.id, userId);
            membersQ.refetch();
            onChanged();
          } catch {
            Alert.alert(t('worldChat.actionFailed'));
          }
        },
      },
    ]);

  const onInvite = async () => {
    if (!picked.size || busy) return;
    setBusy(true);
    try {
      await inviteToRoom(room.id, [...picked]);
      onChanged();
      setTab('main');
      Alert.alert(t('worldChat.rooms.invited', { n: picked.size }));
    } catch (e: any) {
      Alert.alert(t('worldChat.actionFailed'), e?.response?.data?.error ?? '');
    } finally {
      setBusy(false);
    }
  };

  const onCloseRoom = () =>
    Alert.alert(t('worldChat.rooms.closeConfirmTitle'), t('worldChat.rooms.closeConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('worldChat.rooms.closeRoom'),
        style: 'destructive',
        onPress: async () => {
          try {
            await closeChatRoom(room.id);
            onExit();
          } catch {
            Alert.alert(t('worldChat.actionFailed'));
          }
        },
      },
    ]);

  const onDeleteRoom = () =>
    Alert.alert(t('worldChat.rooms.deleteConfirmTitle'), t('worldChat.rooms.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('worldChat.rooms.deleteRoom'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChatRoom(room.id, true);
            onExit();
          } catch {
            Alert.alert(t('worldChat.actionFailed'));
          }
        },
      },
    ]);

  const onLeave = () =>
    Alert.alert(t('worldChat.rooms.leaveConfirmTitle'), t('worldChat.rooms.leaveConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('worldChat.rooms.leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveChatRoom(room.id);
            onExit();
          } catch {
            Alert.alert(t('worldChat.actionFailed'));
          }
        },
      },
    ]);

  // Read-only member list — reachable by any member via "View members". Creators
  // see kick controls in the main settings; here it's view + tap → profile.
  if (tab === 'members') {
    const list = membersQ.data ?? [];
    return (
      <Sheet open={open} onClose={onClose} maxHeight="78%">
        <View style={styles.sheetHeader}>
          <Pressable onPress={() => setTab('main')} hitSlop={8}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.sheetTitle, { color: theme.colors.text, marginBottom: 0, flex: 1 }]}>
            {t('worldChat.rooms.membersN', { n: room.memberCount })}
          </Text>
        </View>
        {membersQ.isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 24 }} />
        ) : (
          <ScrollView style={{ maxHeight: scrollMaxH }}>
            {list.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  onClose();
                  nav.navigate('UserDetail', { userId: m.id });
                }}
                style={[styles.memberRow, { borderColor: theme.colors.line }]}
              >
                <Avatar name={m.displayName} uri={m.avatarUrl} size={38} />
                <NameWithBadge
                  name={m.displayName}
                  official={m.isOfficial}
                  verified={m.isVerified}
                  premium={m.isPremium}
                  badgeSize={14}
                  containerStyle={{ flex: 1 }}
                  textStyle={{ flex: 1, fontSize: 15, color: theme.colors.text, fontWeight: '600' }}
                />
                {m.isCreator && <Crown size={15} color={theme.colors.primary} strokeWidth={2} />}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Sheet>
    );
  }

  // Non-creator member: view members + leave.
  if (!room.isCreator) {
    return (
      <Sheet open={open} onClose={onClose} maxHeight="40%">
        <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>{room.title}</Text>
        <Pressable onPress={() => setTab('invite')} style={[styles.actionRow, { borderColor: theme.colors.line }]}>
          <Text style={{ fontSize: 15, color: theme.colors.text, fontWeight: '600' }}>
            ➕ {t('worldChat.rooms.inviteFriends')}
          </Text>
        </Pressable>
        <Pressable onPress={() => setTab('members')} style={[styles.actionRow, { borderColor: theme.colors.line }]}>
          <Text style={{ fontSize: 15, color: theme.colors.text, fontWeight: '600' }}>
            👥 {t('worldChat.rooms.viewMembers')}
          </Text>
        </Pressable>
        <Pressable onPress={onLeave} style={[styles.actionRow, { borderColor: theme.colors.line }]}>
          <Text style={{ fontSize: 15, color: theme.colors.danger ?? '#E5484D', fontWeight: '700' }}>
            {t('worldChat.rooms.leave')}
          </Text>
        </Pressable>
        <Pressable onPress={onClose} style={styles.actionRow}>
          <Text style={{ fontSize: 15, color: theme.colors.muted, textAlign: 'center', width: '100%' }}>
            {t('common.cancel')}
          </Text>
        </Pressable>
      </Sheet>
    );
  }

  // Invite-friends sub-screen.
  if (tab === 'invite') {
    const friends = friendsQ.data ?? [];
    return (
      <Sheet open={open} onClose={onClose} maxHeight="78%">
        <View style={styles.sheetHeader}>
          <Pressable onPress={() => setTab('main')} hitSlop={8}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.sheetTitle, { color: theme.colors.text, marginBottom: 0, flex: 1 }]}>
            {t('worldChat.rooms.inviteFriends')}
          </Text>
        </View>
        {friendsQ.isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 24 }} />
        ) : friends.length === 0 ? (
          <Text style={{ color: theme.colors.muted, textAlign: 'center', marginVertical: 24 }}>
            {t('worldChat.rooms.noFriends')}
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: scrollMaxH }}>
            {friends.map((f) => {
              const on = picked.has(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      on ? next.delete(f.id) : next.add(f.id);
                      return next;
                    })
                  }
                  style={[styles.memberRow, { borderColor: theme.colors.line }]}
                >
                  <Avatar name={f.displayName} uri={f.avatarUrl} size={38} />
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {f.isOnline && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success ?? theme.colors.online ?? '#3CC479' }} />
                    )}
                    <NameWithBadge
                      name={f.displayName}
                      official={f.isOfficial}
                      verified={f.isVerified}
                      premium={f.isPremium}
                      badgeSize={14}
                      containerStyle={{ flexShrink: 1 }}
                      textStyle={{ flexShrink: 1, fontSize: 15, color: theme.colors.text, fontWeight: '600' }}
                    />
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: on ? theme.colors.primary : theme.colors.line, backgroundColor: on ? theme.colors.primary : 'transparent' },
                    ]}
                  >
                    {on && <Check size={14} color="#FFF" strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <View style={{ marginTop: 14 }}>
          <Button
            label={t('worldChat.rooms.inviteCta', { n: picked.size })}
            onPress={onInvite}
            loading={busy}
            disabled={!picked.size}
            fullWidth
          />
        </View>
      </Sheet>
    );
  }

  // Creator main settings.
  const members = membersQ.data ?? [];
  return (
    <Sheet open={open} onClose={onClose} maxHeight="86%">
      <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>{t('worldChat.rooms.settings')}</Text>
      <ScrollView style={{ maxHeight: scrollMaxH }} keyboardShouldPersistTaps="handled">
        {/* Edit meta */}
        <Text style={[styles.label, { color: theme.colors.muted }]}>{t('worldChat.rooms.fieldTitle')}</Text>
        <TextInput value={title} onChangeText={(x) => setTitle(x.slice(0, 80))} style={input} placeholderTextColor={theme.colors.muted} />
        <Text style={[styles.label, { color: theme.colors.muted, marginTop: 12 }]}>{t('worldChat.rooms.fieldDesc')}</Text>
        <TextInput
          value={description}
          onChangeText={(x) => setDescription(x.slice(0, 300))}
          multiline
          style={[input, { minHeight: 64, textAlignVertical: 'top' }]}
          placeholderTextColor={theme.colors.muted}
        />

        <View style={[styles.privacyRow, { borderColor: theme.colors.line }]}>
          <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: theme.colors.text }}>
            {t('worldChat.rooms.private')}
          </Text>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: theme.colors.primary, false: theme.colors.line }} />
        </View>
        {isPrivate && (
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={room.isPrivate ? t('worldChat.rooms.passwordChangePh') : t('worldChat.rooms.passwordPh')}
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            style={[input, { marginTop: 10 }]}
          />
        )}
        <View style={{ marginTop: 14 }}>
          <Button label={t('worldChat.rooms.save')} onPress={onSaveMeta} loading={busy} disabled={!title.trim()} fullWidth />
        </View>

        {/* Members */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 8 }}>
          <Text style={[styles.label, { color: theme.colors.muted, flex: 1 }]}>
            {t('worldChat.rooms.membersN', { n: room.memberCount })}
          </Text>
          <Pressable onPress={() => setTab('invite')} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <UserPlus size={16} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>{t('worldChat.rooms.invite')}</Text>
          </Pressable>
        </View>
        {membersQ.isLoading ? (
          <ActivityIndicator color={theme.colors.muted} style={{ marginVertical: 12 }} />
        ) : (
          members.map((m) => (
            <View key={m.id} style={[styles.memberRow, { borderColor: theme.colors.line }]}>
              <Avatar name={m.displayName} uri={m.avatarUrl} size={36} />
              <NameWithBadge
                name={m.displayName}
                official={m.isOfficial}
                verified={m.isVerified}
                premium={m.isPremium}
                badgeSize={13}
                containerStyle={{ flex: 1 }}
                textStyle={{ flex: 1, fontSize: 14.5, color: theme.colors.text, fontWeight: '600' }}
              />
              {m.isCreator ? (
                <Crown size={16} color={theme.colors.primary} />
              ) : (
                <Pressable onPress={() => onKick(m.id, m.displayName)} hitSlop={8}>
                  <X size={18} color={theme.colors.danger ?? '#E5484D'} />
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Danger zone */}
      <View style={{ marginTop: 14, gap: 10 }}>
        <Pressable onPress={onCloseRoom} disabled={room.status === 'closed'} style={[styles.dangerBtn, { borderColor: theme.colors.line, opacity: room.status === 'closed' ? 0.5 : 1 }]}>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14.5 }}>
            {room.status === 'closed' ? t('worldChat.rooms.closed') : t('worldChat.rooms.closeRoom')}
          </Text>
        </Pressable>
        <Pressable onPress={onDeleteRoom} style={[styles.dangerBtn, { borderColor: theme.colors.danger ?? '#E5484D' }]}>
          <Text style={{ color: theme.colors.danger ?? '#E5484D', fontWeight: '800', fontSize: 14.5 }}>
            {t('worldChat.rooms.deleteRoom')}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  label: { fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '700', marginBottom: 6 },
  actionRow: { paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dangerBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
});
