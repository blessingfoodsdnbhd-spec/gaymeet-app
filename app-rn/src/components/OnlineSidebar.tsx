import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { Sheet } from './Sheet';
import { Avatar } from './Avatar';
import { UserLevelBadge } from './UserLevelBadge';
import { VerifiedBadge } from './NameWithBadge';
import { getRoomOnline, type OnlineUser } from '../api/plaza';
import { countryCodeToFlag } from '../utils/countryFlag';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * mIRC-style online-user list for the current room (world / country / interest /
 * custom). Opens as a bottom sheet from the "在线 N 人" chip in the chat header.
 * Tapping a user opens their UserDetail (block / follow / DM live there).
 */
export function OnlineSidebar({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  const q = useQuery({
    queryKey: ['plaza', 'online', roomId],
    queryFn: () => getRoomOnline(roomId),
    enabled: open, // only fetch while the sheet is showing
    staleTime: 10_000,
    refetchInterval: open ? 20_000 : false,
  });

  const users = q.data?.users ?? [];

  const openUser = (u: OnlineUser) => {
    onClose();
    nav.navigate('UserDetail', { userId: u.id });
  };

  return (
    <Sheet open={open} onClose={onClose} maxHeight="72%">
      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text, marginBottom: 2 }}>
        {t('plaza.onlineList.title', { n: q.data?.online ?? users.length })}
      </Text>
      <View style={{ height: 1, backgroundColor: theme.colors.line, marginVertical: 10 }} />

      {q.isLoading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          style={{ maxHeight: 420 }}
          refreshControl={
            <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={theme.colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.muted, textAlign: 'center', paddingVertical: 32 }}>
              {t('plaza.onlineList.empty')}
            </Text>
          }
          renderItem={({ item }) => {
            const loc = [countryCodeToFlag(item.countryCode), item.city || ''].filter(Boolean).join(' ');
            return (
              <Pressable
                onPress={() => openUser(item)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  paddingVertical: 8,
                  paddingHorizontal: 4,
                  borderRadius: 12,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Avatar name={item.displayName || '?'} uri={item.avatarUrl} avatarIdx={idxFor(item.id)} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: theme.colors.text, flexShrink: 1 }}>
                      {item.displayName}
                    </Text>
                    {item.isOfficial && <VerifiedBadge size={13} />}
                    <UserLevelBadge level={item.level} />
                    {item.isPremium && (
                      <View
                        style={{
                          backgroundColor: theme.colors.primarySoft,
                          borderRadius: theme.radius.s,
                          paddingHorizontal: 5,
                          paddingVertical: 1.5,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.primaryDeep }}>
                          {t('plaza.onlineList.premium')}
                        </Text>
                      </View>
                    )}
                  </View>
                  {!!loc && (
                    <Text numberOfLines={1} style={{ fontSize: 12, color: theme.colors.muted, marginTop: 1 }}>
                      {loc}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Sheet>
  );
}
