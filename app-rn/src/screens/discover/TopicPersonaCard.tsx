import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../../theme/ThemeProvider';
import type { TopicPersonaListItem } from '../../api/topics';

interface Props {
  item: TopicPersonaListItem;
  width: number;
  onPress: () => void;
}

/**
 * A single persona card in the topic-tab grid. Shows the first photo
 * (or a colored placeholder) with the persona's per-topic nickname
 * overlaid bottom-left, and a small age chip top-right.
 */
export function TopicPersonaCard({ item, width, onPress }: Props) {
  const theme = useTheme();
  const aspectH = Math.round(width * 1.25);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          height: aspectH,
          backgroundColor: theme.colors.surface2,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {item.photo0 ? (
        <ExpoImage
          source={{ uri: item.photo0 }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.surface2 },
          ]}
        />
      )}

      {/* Bottom gradient for legibility — single-color rgba instead of
          dragging in LinearGradient again. */}
      <View style={styles.scrim} />

      <View style={styles.bottom}>
        <Text style={styles.nickname} numberOfLines={1}>
          {item.nickname}
        </Text>
        {item.age != null && (
          <Text style={styles.age}>· {item.age}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  bottom: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  nickname: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  age: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '500',
  },
});
