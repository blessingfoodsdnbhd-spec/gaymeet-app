import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeft, Camera, Video as VideoIcon, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { PhotoVerifiedBadge } from '../../components/NameWithBadge';
import {
  getVerificationStatus,
  getVerificationPose,
  submitSelfieVerification,
  submitVideoVerification,
} from '../../api/verification';

/**
 * Real-person verification (VERIFY1). The user is issued a random pose, records
 * a selfie (or, for Premium, a video) performing it, and submits for admin
 * review. On approval they earn the green PhotoVerifiedBadge.
 */
export function VerificationScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const isPremium = !!(user as any)?.isPremium;

  const statusQ = useQuery({ queryKey: ['verification', 'status'], queryFn: getVerificationStatus });
  const poseQ = useQuery({ queryKey: ['verification', 'pose'], queryFn: getVerificationPose });

  const [media, setMedia] = useState<{ uri: string; kind: 'photo' | 'video' } | null>(null);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!media) throw new Error('no media');
      const pose = poseQ.data?.pose || '';
      return media.kind === 'video'
        ? submitVideoVerification(media.uri, pose)
        : submitSelfieVerification(media.uri, pose);
    },
    onSuccess: () => {
      setMedia(null);
      qc.invalidateQueries({ queryKey: ['verification', 'status'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || e?.message || t('verification.submitFailed');
      Alert.alert(t('verification.submitFailed'), msg);
    },
  });

  const record = async (kind: 'photo' | 'video') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('verification.permTitle'), t('verification.permBody'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: kind === 'video' ? ['videos'] : ['images'],
      cameraType: ImagePicker.CameraType.front,
      quality: 0.7,
      allowsEditing: false,
      ...(kind === 'video' ? { videoMaxDuration: 5 } : {}),
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (uri) setMedia({ uri, kind });
  };

  const status = statusQ.data?.status ?? 'none';
  const c = theme.colors;

  const Header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
      <Pressable onPress={() => nav.goBack()} hitSlop={8}>
        <ChevronLeft size={26} color={c.text} />
      </Pressable>
      <Text style={{ fontSize: 18, fontWeight: '600', color: c.text }}>{t('verification.title')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {Header}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {statusQ.isLoading ? (
          <View style={{ paddingTop: 60 }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : status === 'approved' ? (
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 24 }}>
            <PhotoVerifiedBadge size={56} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('verification.approvedTitle')}</Text>
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
              {t('verification.approvedBody')}
            </Text>
          </View>
        ) : status === 'pending' ? (
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 24 }}>
            <Text style={{ fontSize: 40 }}>⏳</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('verification.pendingTitle')}</Text>
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
              {t('verification.pendingBody')}
            </Text>
          </View>
        ) : (
          <>
            {status === 'rejected' && (
              <View style={{ backgroundColor: c.primarySoft, borderRadius: 14, padding: 14 }}>
                <Text style={{ fontSize: 14, color: c.primaryDeep, fontWeight: '600' }}>
                  {t('verification.rejectedTitle')}
                </Text>
                {!!statusQ.data?.rejectedReason && (
                  <Text style={{ fontSize: 13, color: c.text2, marginTop: 4 }}>{statusQ.data.rejectedReason}</Text>
                )}
              </View>
            )}

            <Text style={{ fontSize: 14, color: c.text2, lineHeight: 21 }}>{t('verification.intro')}</Text>

            {/* Pose challenge */}
            <View style={{ backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 18, gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, letterSpacing: 0.72 }}>
                {t('verification.poseLabel').toUpperCase()}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: c.text }}>
                  {poseQ.isLoading ? '…' : poseQ.data?.pose}
                </Text>
                <Pressable onPress={() => poseQ.refetch()} hitSlop={8}>
                  <RefreshCw size={20} color={c.primary} strokeWidth={2} />
                </Pressable>
              </View>
            </View>

            {/* Preview */}
            {media && (
              media.kind === 'photo' ? (
                <Image source={{ uri: media.uri }} style={{ width: '100%', aspectRatio: 1, borderRadius: 16 }} contentFit="cover" />
              ) : (
                <View style={{ width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <VideoIcon size={36} color={c.success} strokeWidth={1.8} />
                  <Text style={{ fontSize: 13, color: c.text2 }}>{t('verification.videoReady')}</Text>
                </View>
              )
            )}

            {/* Capture buttons */}
            {!media ? (
              <View style={{ gap: 10 }}>
                <CaptureButton
                  icon={<Camera size={20} color="#FFFFFF" strokeWidth={2} />}
                  label={t('verification.recordSelfie')}
                  onPress={() => record('photo')}
                  bg={c.primary}
                />
                <CaptureButton
                  icon={<VideoIcon size={20} color={isPremium ? '#FFFFFF' : c.muted} strokeWidth={2} />}
                  label={isPremium ? t('verification.recordVideo') : t('verification.recordVideoPremium')}
                  onPress={() => (isPremium ? record('video') : nav.navigate('Premium'))}
                  bg={isPremium ? c.secondary : c.surface2}
                  textColor={isPremium ? '#FFFFFF' : c.muted}
                />
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <CaptureButton
                  icon={submitMut.isPending ? <ActivityIndicator color="#FFFFFF" /> : undefined}
                  label={submitMut.isPending ? t('verification.submitting') : t('verification.submit')}
                  onPress={() => submitMut.mutate()}
                  bg={c.success}
                  disabled={submitMut.isPending}
                />
                <Pressable onPress={() => setMedia(null)} disabled={submitMut.isPending} style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ fontSize: 14, color: c.muted, fontWeight: '600' }}>{t('verification.retake')}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CaptureButton({
  icon,
  label,
  onPress,
  bg,
  textColor = '#FFFFFF',
  disabled,
}: {
  icon?: React.ReactNode;
  label: string;
  onPress: () => void;
  bg: string;
  textColor?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 52,
        borderRadius: 999,
        backgroundColor: bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed || disabled ? 0.7 : 1,
      })}
    >
      {icon}
      <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>{label}</Text>
    </Pressable>
  );
}
