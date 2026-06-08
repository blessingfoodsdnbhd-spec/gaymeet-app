import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pencil } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { avatarGradients } from '../../theme/tokens';
import { useDiscoverPrefs, type GridColumns } from '../../store/discoverPrefs';
import { useAuth } from '../../store/auth';
import { prefetchMany } from '../../utils/voiceCache';
import type { DiscoverCardUser } from '../../api/discover';

interface Props {
  users: DiscoverCardUser[];
  onOpen: (user: DiscoverCardUser) => void;
  /** Optional label for the location pill. If omitted, the pill is hidden
   *  rather than showing a misleading hardcoded value. */
  cityLabel?: string;
}

export function NearbyGrid({ users, onOpen, cityLabel }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  // Preload the visible grid's voice intros so tapping a tile's profile plays
  // instantly (the user's slow path was grid taps — the deck preloaded, the grid
  // didn't). Gated on the auto-play pref to match the deck's behavior.
  const introVoicePref = useDiscoverPrefs((s) => s.introVoice);
  React.useEffect(() => {
    if (!introVoicePref) return;
    prefetchMany(users.map((u) => (u as any).voiceIntroUrl));
  }, [users, introVoicePref]);
  // Per user feedback "左边右边 留一点空白" — was edge-to-edge brick
  // (horizontalPad=0, gap=0); now padded sides + a thin gap between
  // tiles so the grid reads as cards, not a poster wall.
  // Column count is user-selectable (2/3/4) and persisted; the tile width is
  // derived from the live window width so it adapts across Android DPIs/sizes.
  const cols = useDiscoverPrefs((s) => s.gridColumns);
  const setCols = useDiscoverPrefs((s) => s.setGridColumns);
  // Premium virtual-location indicator — shown whenever a virtual location is
  // ACTIVE (coords set), so it never silently disappears when the map's
  // reverse-geocoded label happens to be empty (SSS bug). Label is display-only.
  const virtualLat = useAuth((s) => s.user?.preferences?.virtualLat ?? null);
  const virtualLng = useAuth((s) => s.user?.preferences?.virtualLng ?? null);
  const virtualLabel = useAuth((s) => s.user?.preferences?.virtualLocationLabel ?? null);
  const virtualActive = virtualLat != null && virtualLng != null;
  const gap = 4;
  const horizontalPad = 14;
  const tileW = (width - horizontalPad * 2 - gap * (cols - 1)) / cols;
  const tileH = tileW; // square

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.cityRow}>
        {virtualActive ? (
          <Pressable
            onPress={() => nav.navigate('MapPicker')}
            hitSlop={6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: theme.colors.primarySoft,
              borderWidth: 1,
              borderColor: theme.colors.primary,
            }}
          >
            <Text style={{ fontSize: 12.5, color: theme.colors.primaryDeep }}>
              📍 {t('virtualLocation.indicator', { city: virtualLabel || t('virtualLocation.active') })}
            </Text>
            <Pencil size={12} color={theme.colors.primaryDeep} strokeWidth={2} />
          </Pressable>
        ) : cityLabel ? (
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
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 12, color: theme.colors.muted }}>
            {t('nearby.peopleCount', { n: users.length })}
          </Text>
          {/* Column chooser: 2 / 3 / 4 — persisted via discoverPrefs. */}
          <View style={[styles.colChooser, { borderColor: theme.colors.line }]}>
            {([2, 3, 4] as GridColumns[]).map((n) => {
              const active = cols === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setCols(n)}
                  hitSlop={4}
                  style={[
                    styles.colOption,
                    active && { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: active ? '#FFFFFF' : theme.colors.text2,
                    }}
                  >
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
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
            {t('nearby.footnote')}
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
  // Backend may not always populate avatarIdx (it's a server-computed
  // helper for the no-photo gradient fallback). NaN % n is NaN, which
  // would index out-of-bounds and crash the destructure.
  const [a, b] = avatarGradients[(user.avatarIdx ?? 0) % avatarGradients.length];
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
  colChooser: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  colOption: {
    width: 26,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBg: {
    flex: 1,
    // Rounded a touch so the now-spaced tiles read as cards instead of
    // sharp squares floating in the new gap. If the user prefers the
    // old brutalist sharp-edge look, drop this to 0.
    borderRadius: 10,
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
