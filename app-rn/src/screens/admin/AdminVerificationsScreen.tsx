import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { ChevronLeft, Play, Video as VideoIcon, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components/EmptyState';
import { usePhotoViewer } from '../../components/usePhotoViewer';
import { getAdminVerifications, approveVerification, rejectVerification, type AdminVerification } from '../../api/admin';
import { resolveMediaUrl } from '../../api/verification';

/** Admin photo/video verification review (VERIFY1). */
export function AdminVerificationsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const photoViewer = usePhotoViewer();
  // Fullscreen video review — video submissions can't open a static image viewer
  // (the thumbnail was a dead VideoIcon). Tapping it now plays the clip so the
  // reviewer can actually watch the requested pose before approve/reject.
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);

  const q = useQuery({ queryKey: ['admin', 'verifications'], queryFn: getAdminVerifications });

  // Tap username/avatar → open the user's full profile (returns here on back).
  const openProfile = (userId: string | null) => {
    if (userId) nav.navigate('UserDetail', { userId });
  };

  const remove = (id: string) =>
    qc.setQueryData(['admin', 'verifications'], (old: any) =>
      old ? { ...old, verifications: old.verifications.filter((v: AdminVerification) => v.id !== id), count: old.count - 1 } : old,
    );

  const approveMut = useMutation({
    mutationFn: (id: string) => approveVerification(id),
    onMutate: (id) => remove(id),
    onError: () => qc.invalidateQueries({ queryKey: ['admin', 'verifications'] }),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectVerification(id),
    onMutate: (id) => remove(id),
    onError: () => qc.invalidateQueries({ queryKey: ['admin', 'verifications'] }),
  });

  const confirmReject = (id: string) =>
    Alert.alert(t('adminVerifications.rejectConfirmTitle'), t('adminVerifications.rejectConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('adminVerifications.reject'), style: 'destructive', onPress: () => rejectMut.mutate(id) },
    ]);

  const items = q.data?.verifications ?? [];
  const c = theme.colors;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={theme.iconSize.l} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>{t('adminVerifications.title')}</Text>
      </View>

      {q.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : items.length === 0 ? (
        <EmptyState emoji="✅" title={t('adminVerifications.empty')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const img = resolveMediaUrl(item.selfieUrl || item.videoUrl);
            const isVideo = item.verificationType === 'video';
            return (
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {/* Tap the submitted media → photo opens the pinch-to-zoom
                      viewer; video opens the fullscreen player below. */}
                  <Pressable
                    onPress={() => {
                      if (!img) return;
                      if (isVideo) setVideoUrl(img);
                      else photoViewer.open([img], 0);
                    }}
                    disabled={!img}
                    style={{ width: 84, height: 84, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isVideo ? (
                      <>
                        <VideoIcon size={28} color={c.success} strokeWidth={1.8} />
                        {/* play affordance so it reads as tappable */}
                        <View style={styles.playBadge}>
                          <Play size={12} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
                        </View>
                      </>
                    ) : img ? (
                      <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <Text style={{ fontSize: 11, color: c.muted }}>—</Text>
                    )}
                  </Pressable>
                  <View style={{ flex: 1, gap: 4 }}>
                    {/* Tap avatar + name → the user's profile. */}
                    <Pressable
                      onPress={() => openProfile(item.userId)}
                      disabled={!item.userId}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      {item.avatarUrl ? (
                        <Image source={{ uri: resolveMediaUrl(item.avatarUrl) || undefined }} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.surface2 }} contentFit="cover" />
                      ) : null}
                      <Text style={{ fontSize: 15, fontWeight: '700', color: item.userId ? c.primary : c.text }} numberOfLines={1}>{item.nickname}</Text>
                      <View style={[styles.kindChip, { backgroundColor: isVideo ? c.secondary : c.primarySoft }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: isVideo ? '#FFFFFF' : c.primaryDeep }}>
                          {isVideo ? t('adminVerifications.video') : t('adminVerifications.photo')}
                        </Text>
                      </View>
                    </Pressable>
                    <Text style={{ fontSize: 13, color: c.text2 }} numberOfLines={2}>
                      {t('adminVerifications.poseLabel')}: {item.pose}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={() => approveMut.mutate(item.id)}
                    style={({ pressed }) => [styles.btn, { backgroundColor: c.success, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text style={styles.btnTxt}>{t('adminVerifications.approve')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmReject(item.id)}
                    style={({ pressed }) => [styles.btn, { backgroundColor: c.surface2, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text style={[styles.btnTxt, { color: c.danger }]}>{t('adminVerifications.reject')}</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
      {photoViewer.node}

      {/* Fullscreen video player for video verifications. expo-av Video with
          native controls (scrub/pause) so the reviewer can inspect the pose. */}
      <Modal
        visible={!!videoUrl}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVideoUrl(null)}
      >
        <View style={styles.videoBackdrop}>
          {videoUrl ? (
            <Video
              source={{ uri: videoUrl }}
              style={styles.videoPlayer}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              isLooping
            />
          ) : null}
          <Pressable onPress={() => setVideoUrl(null)} hitSlop={16} style={styles.videoClose}>
            <X size={26} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  kindChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 999 },
  btnTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  playBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  videoPlayer: { width: '100%', height: '72%' },
  videoClose: { position: 'absolute', top: 54, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
