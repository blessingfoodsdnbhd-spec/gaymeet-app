import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Crown, Pencil, X } from 'lucide-react-native';

import { Sheet } from '../../components/Sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { PhotoViewer } from '../../components/PhotoViewer';
import { useTheme } from '../../theme/ThemeProvider';
import { getTopicPersona } from '../../api/topics';
import { navigateAfterSheetClose } from '../../utils/keyboardSheet';
import { TopicUnlockRequestSheet } from './TopicUnlockRequestSheet';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  open: boolean;
  slug: string | null;
  userId: string | null;
  // Topic name/icon to pass to the edit screen when the viewer edits their own
  // persona. Optional — falls back to the slug if absent.
  topicName?: string;
  topicIcon?: string;
  onClose: () => void;
}

/**
 * Full-screen sheet view of one topic persona — mirrors AboutUserSheet's
 * redesign (95% sheet, full-bleed photo carousel on top, scrollable content
 * below, sticky action footer). The viewer sees:
 *   - photo carousel (tap → PhotoViewer)
 *   - per-topic nickname + age
 *   - bio (shared from main profile)
 * Footer: self → "Edit photos"; others (no unlock) → "Request to see other
 * topics" (opens TopicUnlockRequestSheet). Component-level layout → applies to
 * every topic (白襪 / 眼鏡 / 西藏 / future) with no per-topic handling.
 */
export function TopicPersonaSheet({
  open,
  slug,
  userId,
  topicName,
  topicIcon,
  onClose,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [unlockRequestOpen, setUnlockRequestOpen] = useState(false);
  // Full-screen photo viewer state — index of the photo to show. Null
  // = closed. Same pattern as AboutUserSheet so the photo gallery UX
  // matches across the two sheets.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const enabled = open && !!slug && !!userId;
  const q = useQuery({
    queryKey: ['topics', slug, 'persona', userId],
    queryFn: () => getTopicPersona(slug!, userId!),
    enabled,
    staleTime: 30_000,
  });

  const persona = q.data;
  const isSelf = !!persona?.isSelf;
  const hasUnlock = !!persona?.mainProfile;
  const galleryPhotos = persona?.photos ?? [];

  const goEditPhotos = () => {
    if (!persona) return;
    // Defer the push past this Sheet's Android Dialog teardown — same-tick close
    // + navigate is dropped on Android. See navigateAfterSheetClose.
    navigateAfterSheetClose(onClose, () =>
      nav.navigate('TopicPersonaEdit', {
        topicSlug: persona.topicSlug,
        topicName: topicName ?? persona.topicSlug,
        topicIcon,
      }),
    );
  };

  // Reset viewer/carousel state when the sheet's target persona changes —
  // otherwise opening a second persona keeps the prior PhotoViewer
  // index, which would be a phantom open on first paint.
  React.useEffect(() => {
    setViewerIndex(null);
    setPage(0);
  }, [userId, slug]);

  // Mirror AboutUserSheet: a definite-height full-bleed carousel forces the
  // sheet to ~95% (Sheet is absolute + maxHeight only, so without a tall child
  // it would shrink to content). The inner ScrollView is bounded so it scrolls.
  const carouselH = Math.round(screenH * 0.5);
  const footerShown = isSelf || (!hasUnlock && !!persona && !isSelf);
  const scrollMaxH = screenH * 0.95 - (footerShown ? 96 : 28);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      maxHeight="95%"
      overlay={
        <PhotoViewer
          open={viewerIndex !== null}
          photos={galleryPhotos}
          initialIndex={viewerIndex ?? 0}
          onClose={() => setViewerIndex(null)}
        />
      }
    >
      {q.isLoading && (
        <View style={[styles.centered, { height: carouselH }]}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {q.isError && (
        <View style={[styles.centered, { height: carouselH }]}>
          <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
            {t('topics.loadFailed')}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} style={[styles.overlayBtn, { right: 0, top: 0 }]}>
            <X size={20} color={theme.colors.text} strokeWidth={1.6} />
          </Pressable>
        </View>
      )}

      {persona && (
        <View style={{ flex: 1 }}>
          {/* Outer vertical scroll → BottomSheetScrollView for gesture-context
              registration; inner horizontal photo pager stays RN ScrollView. */}
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: scrollMaxH, marginHorizontal: -20, marginTop: -6 }}
          >
            {/* Full-bleed photo carousel — paged, tap any photo to zoom. */}
            <View style={{ width: screenW, height: carouselH, backgroundColor: theme.colors.surface2 }}>
              {galleryPhotos.length > 0 ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) =>
                    setPage(Math.round(e.nativeEvent.contentOffset.x / screenW))
                  }
                >
                  {galleryPhotos.map((url, idx) => (
                    <Pressable
                      key={`c-${idx}-${url}`}
                      onPress={() => setViewerIndex(idx)}
                      style={{ width: screenW, height: carouselH }}
                    >
                      <ExpoImage
                        source={{ uri: url }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 64 }}>{topicIcon || '📸'}</Text>
                </View>
              )}

              {galleryPhotos.length > 1 && (
                <View style={styles.dots} pointerEvents="none">
                  {galleryPhotos.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.5)' },
                      ]}
                    />
                  ))}
                </View>
              )}

              <Pressable onPress={onClose} hitSlop={8} style={[styles.overlayBtn, { right: 14 }]}>
                <X size={20} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
              {isSelf && (
                <Pressable onPress={goEditPhotos} hitSlop={8} style={[styles.overlayBtn, { left: 14 }]}>
                  <Pencil size={18} color="#FFFFFF" strokeWidth={2} />
                </Pressable>
              )}
            </View>

            {/* Details */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <Text style={[styles.nameBig, { color: theme.colors.text }]}>
                {persona.nickname}
                {persona.age != null ? ` · ${persona.age}` : ''}
              </Text>

              {persona.bio ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.section, { color: theme.colors.muted }]}>
                    {t('topics.about')}
                  </Text>
                  <Text style={{ fontSize: 14, lineHeight: 22, color: theme.colors.text2 }}>
                    {persona.bio}
                  </Text>
                </View>
              ) : null}

              {/* Cross-topic block. Only present when an approved unlock
                  exists; backend gates the payload, client just renders. */}
              {hasUnlock && persona.mainProfile && (
                <View style={{ marginTop: 22, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.line }}>
                  <Text style={[styles.section, { color: theme.colors.muted }]}>
                    {t('topics.otherTopicsHeader')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {persona.mainProfile.avatarUrl ? (
                      <ExpoImage
                        source={{ uri: persona.mainProfile.avatarUrl }}
                        style={{ width: 44, height: 44, borderRadius: 22 }}
                      />
                    ) : null}
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
                      {persona.mainProfile.nickname}
                    </Text>
                  </View>
                  <View style={{ gap: 8, marginTop: 12 }}>
                    {persona.mainProfile.otherTopics.length === 0 ? (
                      <Text style={{ fontSize: 13, color: theme.colors.muted }}>
                        {t('topics.noOtherTopics')}
                      </Text>
                    ) : (
                      persona.mainProfile.otherTopics.map((ot) => (
                        <View
                          key={ot.topicSlug}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            paddingVertical: 6,
                          }}
                        >
                          {ot.photo0 ? (
                            <ExpoImage
                              source={{ uri: ot.photo0 }}
                              style={{ width: 46, height: 46, borderRadius: 10 }}
                            />
                          ) : (
                            <View
                              style={{
                                width: 46,
                                height: 46,
                                borderRadius: 10,
                                backgroundColor: theme.colors.surface2,
                              }}
                            />
                          )}
                          <View>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>
                              {ot.nickname}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.colors.muted, marginTop: 2 }}>
                              {ot.topicSlug}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}
            </View>
          </BottomSheetScrollView>

          {/* Sticky action footer. Self → edit own photos; others without an
              approved unlock → request cross-topic unlock. */}
          {isSelf ? (
            <View style={styles.footer}>
              <Pressable
                onPress={goEditPhotos}
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Pencil size={16} color="#FFFFFF" strokeWidth={2} />
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                  {t('topics.editYourPhotos')}
                </Text>
              </Pressable>
            </View>
          ) : !hasUnlock ? (
            <View style={styles.footer}>
              <Pressable
                onPress={() => setUnlockRequestOpen(true)}
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: theme.colors.primarySoft,
                    borderColor: theme.colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Crown size={16} color={theme.colors.primaryDeep} strokeWidth={2} />
                <Text style={{ color: theme.colors.primaryDeep, fontSize: 14, fontWeight: '700' }}>
                  {t('topics.requestUnlock')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      {persona && !isSelf && (
        <TopicUnlockRequestSheet
          open={unlockRequestOpen}
          ownerId={persona.userId}
          ownerNickname={persona.nickname}
          onClose={() => setUnlockRequestOpen(false)}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBig: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  overlayBtn: {
    position: 'absolute',
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
});
