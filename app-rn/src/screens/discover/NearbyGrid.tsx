import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';
import { avatarGradients } from '../../theme/tokens';
import type { DiscoverCardUser } from '../../api/discover';

interface Props {
  users: DiscoverCardUser[];
  onOpen: (user: DiscoverCardUser) => void;
  cityLabel?: string;
}

export function NearbyGrid({ users, onOpen, cityLabel = 'KL · Bangsar' }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cols = 4;
  const gap = 8;
  const horizontalPad = 14;
  const tileW = (width - horizontalPad * 2 - gap * (cols - 1)) / cols;
  const tileH = tileW * 1.18;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.cityRow}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.line,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: theme.colors.online,
            }}
          />
          <Text style={{ fontSize: 12.5, color: theme.colors.text2 }}>{cityLabel}</Text>
        </View>
        <Text style={{ fontSize: 12, color: theme.colors.muted }}>
          {users.length} 人在附近
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: horizontalPad, paddingBottom: 24 }}
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap,
          }}
        >
          {users.map((u) => (
            <Tile
              key={u.id}
              user={u}
              width={tileW}
              height={tileH}
              onPress={() => onOpen(u)}
            />
          ))}
        </View>
        <View style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 8 }}>
          <Text style={{ fontSize: 11.5, color: theme.colors.muted }}>
            仅显示开启了"附近"的同好
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Tile({
  user,
  width,
  height,
  onPress,
}: {
  user: DiscoverCardUser;
  width: number;
  height: number;
  onPress: () => void;
}) {
  const [a, b] = avatarGradients[user.avatarIdx % avatarGradients.length];
  const initial = (user.nickname || '?').trim().charAt(0).toUpperCase();
  const hasPhoto = !!user.avatarUrl;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        height,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={[styles.tileBg, { overflow: 'hidden' }]}>
        {hasPhoto ? (
          <Image
            source={{ uri: user.avatarUrl! }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <LinearGradient
            colors={[a, b]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            <Text style={styles.tileInitial}>{initial}</Text>
          </LinearGradient>
        )}

        {user.isOnline && <View style={styles.onlineDot} />}

        <LinearGradient
          colors={['rgba(20,10,5,0)', 'rgba(20,10,5,0.65)']}
          style={styles.tileOverlay}
        >
          <Text style={styles.tileName} numberOfLines={1}>{user.nickname}</Text>
          {user.distance && (
            <Text style={styles.tileDist}>{user.distance}</Text>
          )}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tileBg: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  tileInitial: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: 'Fraunces',
    fontStyle: 'italic',
    fontSize: 48,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -2,
    lineHeight: 90,
  },
  onlineDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#3CC479',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  tileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingBottom: 7,
    paddingTop: 22,
  },
  tileName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tileDist: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
});
