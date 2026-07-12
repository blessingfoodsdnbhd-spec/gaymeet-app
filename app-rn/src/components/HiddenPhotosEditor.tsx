import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { getHiddenPhotos, getHiddenGrants, toggleHiddenPhoto } from '../api/hiddenPhotos';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  userId: string;
  /** Current public photos (owned by parent EditProfile state). */
  publicPhotos: string[];
  /** Sync parent state after a toggle moves a photo between arrays. */
  onPhotosChange: (photos: string[]) => void;
}

const TILE = 88;

/**
 * 隐藏照片 manager for the Edit Profile screen. Lists the user's public photos
 * (tap to hide) and their currently-hidden photos (tap to reveal). A hidden
 * photo is a subset of the profile photos — the toggle just moves the URL
 * between User.photos and User.hiddenPhotos server-side. Also surfaces a link
 * to the grants-management screen ("N 人已获得授权").
 */
export function HiddenPhotosEditor({ userId, publicPhotos, onPhotosChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigation<Nav>();

  const hiddenQ = useQuery({
    queryKey: ['me', 'hiddenPhotos'],
    queryFn: () => getHiddenPhotos(userId),
    staleTime: 30_000,
  });
  const hidden = hiddenQ.data?.photos ?? [];

  const grantsQ = useQuery({
    queryKey: ['me', 'hiddenGrants'],
    queryFn: getHiddenGrants,
    staleTime: 30_000,
  });
  const grantCount = grantsQ.data?.count ?? 0;

  const toggleMut = useMutation({
    mutationFn: ({ url, hide }: { url: string; hide: boolean }) => toggleHiddenPhoto(url, hide),
    onSuccess: (res) => {
      onPhotosChange(res.photos);
      // Reflect the new hidden list immediately without a refetch round-trip.
      qc.setQueryData(['me', 'hiddenPhotos'], (prev: any) =>
        prev ? { ...prev, photos: res.hiddenPhotos, count: res.hiddenPhotosCount } : prev,
      );
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const busy = toggleMut.isPending;

  return (
    <View>
      <Text style={{ color: theme.colors.muted, fontSize: 12, marginBottom: 10 }}>
        {t('hiddenPhotos.editorHint')}
      </Text>

      {/* Public photos — tap the eye-off to hide. */}
      {publicPhotos.length === 0 ? (
        <Text style={{ color: theme.colors.muted, fontSize: 13, marginBottom: 12 }}>
          {t('hiddenPhotos.noPublicPhotos')}
        </Text>
      ) : (
        <View style={styles.grid}>
          {publicPhotos.map((url) => (
            <Pressable
              key={url}
              disabled={busy}
              onPress={() => toggleMut.mutate({ url, hide: true })}
              style={({ pressed }) => [styles.tileWrap, { opacity: pressed || busy ? 0.7 : 1 }]}
            >
              <ExpoImage source={{ uri: url }} style={styles.tile} cachePolicy="memory-disk" contentFit="cover" />
              <View style={[styles.actionBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <EyeOff size={13} color="#FFFFFF" strokeWidth={2.2} />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Hidden photos — 🔒 overlay, tap to reveal. */}
      {hidden.length > 0 && (
        <>
          <Text style={{ color: theme.colors.text2, fontSize: 12.5, fontWeight: '700', marginTop: 6, marginBottom: 8 }}>
            {t('hiddenPhotos.currentlyHidden', { n: hidden.length })}
          </Text>
          <View style={styles.grid}>
            {hidden.map((url) => (
              <Pressable
                key={url}
                disabled={busy}
                onPress={() => toggleMut.mutate({ url, hide: false })}
                style={({ pressed }) => [styles.tileWrap, { opacity: pressed || busy ? 0.7 : 1 }]}
              >
                <ExpoImage source={{ uri: url }} style={styles.tile} cachePolicy="memory-disk" contentFit="cover" />
                <View style={styles.lockOverlay}>
                  <Lock size={18} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <View style={[styles.actionBadge, { backgroundColor: theme.colors.primary }]}>
                  <Eye size={13} color="#FFFFFF" strokeWidth={2.2} />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {(hiddenQ.isLoading || grantsQ.isLoading) && (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 8 }} />
      )}

      {/* Manage grants — "N 人已获得授权". */}
      <Pressable
        onPress={() => nav.navigate('MyHiddenPhotos')}
        style={({ pressed }) => ({ marginTop: 12, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>
          {t('hiddenPhotos.manageGrants', { n: grantCount })} ›
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { width: TILE, height: TILE, borderRadius: 12, position: 'relative' },
  tile: { width: TILE, height: TILE, borderRadius: 12 },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
