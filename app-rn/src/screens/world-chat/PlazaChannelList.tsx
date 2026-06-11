import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import type { WorldChatRoom } from '../../api/worldChat';

export interface ChannelItem {
  id: string;
  flag: string;
  name: string;
  onlineCount: number;
}

/**
 * 二级频道列表 (spec §8.2, grid style). Click-to-select navigation — NO scroll
 * switching (spec §8.1). Each card shows the channel name + live online count
 * (required by §8.2). Used by the 交友 / 语音 / 兴趣 / 国家 tabs.
 */
export function PlazaChannelList({
  channels,
  onOpen,
}: {
  channels: ChannelItem[];
  onOpen: (c: ChannelItem) => void;
}) {
  const theme = useTheme();
  return (
    <FlatList
      data={channels}
      keyExtractor={(c) => c.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 12 }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpen(item)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={{ fontSize: 28 }}>{item.flag}</Text>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginTop: 8 }}>
            {item.name}
          </Text>
          <View style={styles.countRow}>
            <View style={[styles.dot, { backgroundColor: theme.colors.online }]} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.muted }}>{item.onlineCount}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

export function channelFromRoom(r: WorldChatRoom, name: string, count: number): ChannelItem {
  return { id: r.id, flag: r.flag, name, onlineCount: count };
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 104,
    justifyContent: 'center',
  },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
