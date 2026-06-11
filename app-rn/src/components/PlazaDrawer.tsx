import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Globe, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../store/auth';
import { getWorldChatRooms, type WorldChatRoom } from '../api/worldChat';
import { on as wsOn } from '../api/ws';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
export type DrawerRoomPick = { id: string; title: string };

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.84);

/**
 * The 广场 room drawer — slides in from the left. World Lobby + country rooms,
 * each with a live online count. Tapping a room switches the lobby in-place; the
 * trailing chevron on a country opens its custom-room list (browse / create).
 */
export function PlazaDrawer({
  open,
  onClose,
  activeRoomId,
  onSelectRoom,
}: {
  open: boolean;
  onClose: () => void;
  activeRoomId: string;
  onSelectRoom: (room: DrawerRoomPick) => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const myCountry = useAuth((s) => s.user?.countryCode) ?? null;
  const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';

  // Keep the Modal mounted through the slide-out so the exit animates.
  const [visible, setVisible] = React.useState(open);
  const tx = React.useRef(new Animated.Value(-WIDTH)).current;
  const backdrop = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (open) {
      setVisible(true);
      Animated.parallel([
        Animated.timing(tx, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(tx, { toValue: -WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }
  }, [open, tx, backdrop]);

  const roomsQ = useQuery({
    queryKey: ['worldChat', 'rooms'],
    queryFn: getWorldChatRooms,
    staleTime: 20_000,
    enabled: visible,
  });

  const [liveCounts, setLiveCounts] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const u = await wsOn('world-chat:rooms-state', ({ counts }) => {
        if (!cancelled) setLiveCounts(counts);
      });
      if (cancelled) u();
      else unsub = u;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [visible]);

  const rooms: WorldChatRoom[] = React.useMemo(() => {
    const base = (roomsQ.data?.rooms ?? []).map((r) => ({
      ...r,
      onlineCount: liveCounts[r.id] ?? r.onlineCount,
    }));
    // World first, then the viewer's own country, then by online count.
    const rank = (r: WorldChatRoom) => (r.id === 'world' ? -2 : r.id === myCountry ? -1 : 0);
    return base.sort((a, b) => rank(a) - rank(b) || b.onlineCount - a.onlineCount);
  }, [roomsQ.data, liveCounts, myCountry]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', opacity: backdrop }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            { width: WIDTH, backgroundColor: theme.colors.bg, transform: [{ translateX: tx }] },
          ]}
        >
          {(
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'bottom']}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                  color: theme.colors.muted,
                  paddingHorizontal: 20,
                  paddingTop: 14,
                  paddingBottom: 8,
                }}
              >
                {t('plaza.rooms')}
              </Text>

              {roomsQ.isLoading ? (
                <View style={{ paddingTop: 40, alignItems: 'center' }}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : (
                <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}>
                  {rooms.map((r) => {
                    const active = r.id === activeRoomId;
                    const isWorld = r.id === 'world';
                    const name = isWorld ? t('plaza.worldLobby') : r.label[lang] || r.label.en;
                    return (
                      <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Pressable
                          onPress={() => onSelectRoom({ id: r.id, title: name })}
                          style={({ pressed }) => [
                            styles.row,
                            {
                              flex: 1,
                              backgroundColor: active ? theme.colors.primarySoft : 'transparent',
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          {isWorld ? (
                            <Globe size={22} color={active ? theme.colors.primaryDeep : theme.colors.text} strokeWidth={2} />
                          ) : (
                            <Text style={{ fontSize: 22 }}>{r.flag}</Text>
                          )}
                          <Text
                            numberOfLines={1}
                            style={{
                              flex: 1,
                              fontSize: 15,
                              fontWeight: active ? '800' : '600',
                              color: active ? theme.colors.primaryDeep : theme.colors.text,
                            }}
                          >
                            {name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: r.onlineCount > 0 ? theme.colors.online : theme.colors.muted,
                              }}
                            />
                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.muted }}>
                              {r.onlineCount}
                            </Text>
                          </View>
                        </Pressable>
                        {!isWorld && (
                          <Pressable
                            onPress={() => {
                              onClose();
                              nav.navigate('CountryRooms', {
                                countryCode: r.id,
                                title: `${r.flag} ${name}`,
                              });
                            }}
                            hitSlop={8}
                            style={{ paddingHorizontal: 10, paddingVertical: 12 }}
                            accessibilityLabel={t('plaza.browse')}
                          >
                            <ChevronRight size={18} color={theme.colors.muted} />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </SafeAreaView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
  },
});
