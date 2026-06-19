import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Copy, Link2, MessageCircle, Send, MessageSquare } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '../theme/ThemeProvider';
import { getChatRoom } from '../api/worldChat';
import { roomShareUrl } from '../utils/roomLink';
import { showToast } from '../utils/toastBridge';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'InviteRoom'>;

/**
 * v3.1.10 — full-screen room invite. Replaces the OS Share sheet AND the old
 * roster-sheet "邀请" entry (both removed to kill the Android touch bugs). Shows
 * a QR code + copyable link + direct deep-links into external apps (WhatsApp /
 * Telegram / SMS / WeChat). Every button deep-links straight out — NO RN Modal,
 * NO OS share sheet.
 */
export function InviteRoomScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { roomId, roomTitle } = useRoute<Rt>().params;

  const roomQ = useQuery({
    queryKey: ['worldChat', 'room', roomId],
    queryFn: () => getChatRoom(roomId),
    staleTime: 30_000,
    select: (d) => d.room,
  });
  const room = roomQ.data;
  const name = room?.title ?? roomTitle ?? '';
  const description = room?.description ?? '';

  const link = roomShareUrl(roomId);
  const shareText = t('worldChat.rooms.shareMessage', { name, link });

  const onCopy = async () => {
    await Clipboard.setStringAsync(link);
    showToast(t('inviteRoom.copied'), 'success');
  };

  // Deep-link straight into the target app. If it isn't installed (canOpenURL
  // false / throws), fall back to copying the link so the invite never dead-ends.
  const openExternal = async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fall through to copy */
    }
    await Clipboard.setStringAsync(link);
    showToast(t('inviteRoom.appMissing'), 'info');
  };

  const txt = encodeURIComponent(shareText);
  const apps: { key: string; label: string; icon: React.ReactNode; url: string; color: string }[] = [
    { key: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={22} color="#FFFFFF" />, url: `whatsapp://send?text=${txt}`, color: '#25D366' },
    { key: 'telegram', label: 'Telegram', icon: <Send size={21} color="#FFFFFF" />, url: `tg://msg?text=${txt}`, color: '#2AABEE' },
    { key: 'sms', label: t('inviteRoom.sms'), icon: <MessageSquare size={21} color="#FFFFFF" />, url: `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${txt}`, color: theme.colors.success },
    { key: 'wechat', label: t('inviteRoom.wechat'), icon: <MessageCircle size={22} color="#FFFFFF" />, url: 'weixin://', color: '#07C160' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{t('inviteRoom.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.xl }}>
        {/* Room name + description */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={2} style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center' }}>
            {name}
          </Text>
          {!!description && (
            <Text numberOfLines={3} style={{ fontSize: 13.5, color: theme.colors.text2, textAlign: 'center', lineHeight: 20 }}>
              {description}
            </Text>
          )}
        </View>

        {/* QR code */}
        <View style={[styles.qrCard, { backgroundColor: '#FFFFFF', borderColor: theme.colors.line }]}>
          <QRCode value={link} size={196} backgroundColor="#FFFFFF" color="#1F1E29" />
        </View>
        <Text style={{ fontSize: 12.5, color: theme.colors.muted, marginTop: -8 }}>{t('inviteRoom.scanHint')}</Text>

        {/* Link + copy */}
        <View style={[styles.linkRow, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.line }]}>
          <Link2 size={16} color={theme.colors.muted} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: theme.colors.text2 }}>{link}</Text>
        </View>
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => [styles.copyBtn, { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
        >
          <Copy size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{t('inviteRoom.copy')}</Text>
        </Pressable>

        {/* External apps — each deep-links straight out (no OS share sheet) */}
        <View style={{ width: '100%', gap: 10 }}>
          <Text style={{ fontSize: 12.5, color: theme.colors.muted, marginBottom: 2 }}>{t('inviteRoom.shareVia')}</Text>
          <View style={styles.appRow}>
            {apps.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => openExternal(a.url)}
                style={({ pressed }) => [styles.appBtn, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <View style={[styles.appIcon, { backgroundColor: a.color }]}>{a.icon}</View>
                <Text style={{ fontSize: 12, color: theme.colors.text2, fontWeight: '600' }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
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
  qrCard: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 50,
    borderRadius: 14,
  },
  appRow: { flexDirection: 'row', justifyContent: 'space-between' },
  appBtn: { alignItems: 'center', gap: 7, flex: 1 },
  appIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
