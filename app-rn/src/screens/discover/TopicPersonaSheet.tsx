import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Crown, Pencil, X } from 'lucide-react-native';

import { Sheet } from '../../components/Sheet';
import { PhotoViewer } from '../../components/PhotoViewer';
import { useTheme } from '../../theme/ThemeProvider';
import { getTopicPersona } from '../../api/topics';
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
 * Full sheet view of one topic persona. The viewer sees:
 *   - photos carousel
 *   - per-topic nickname + age
 *   - bio (shared from main profile)
 * Plus a CTA "Request to see other topics" that opens
 * TopicUnlockRequestSheet. If the viewer already has an approved
 * unlock, the sheet shows a "mainProfile" section listing the owner's
 * other topic personas + real nickname + main photos.
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
  const [unlockRequestOpen, setUnlockRequestOpen] = useState(false);
  // Full-screen photo viewer state — index of the photo to show. Null
  // = closed. Same pattern as AboutUserSheet so the photo gallery UX
  // matches across the two sheets.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

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
    onClose();
    nav.navigate('TopicPersonaEdit', {
      topicSlug: persona.topicSlug,
      topicName: topicName ?? persona.topicSlug,
      topicIcon,
    });
  };

  // Reset viewer state when the sheet's target persona changes —
  // otherwise opening a second persona keeps the prior PhotoViewer
  // index, which would be a phantom open on first paint.
  React.useEffect(() => {
    setViewerIndex(null);
  }, [userId, slug]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      maxHeight="92%"
      overlay={
        <PhotoViewer
          open={viewerIndex !== null}
          photos={galleryPhotos}
          initialIndex={viewerIndex ?? 0}
          onClose={() => setViewerIndex(null)}
        />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {persona ? persona.nickname : t('topics.loading')}
          {persona?.age != null ? ` · ${persona.age}` : ''}
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={{ padding: 6, marginRight: -6 }}
        >
          <X size={20} color={theme.colors.text} strokeWidth={1.6} />
        </Pressable>
      </View>

      {q.isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {q.isError && (
        <View style={styles.centered}>
          <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
            {t('topics.loadFailed')}
          </Text>
        </View>
      )}

      {persona && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Photo gallery — 96x96 horizontal-scroll thumbnails that
              open the full-screen PhotoViewer on tap. Matches the
              public-photos block on AboutUserSheet exactly so the two
              sheets feel like one design. */}
          {galleryPhotos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 8 }}
            >
              {galleryPhotos.map((url, idx) => (
                <Pressable
                  key={`${idx}-${url}`}
                  onPress={() => setViewerIndex(idx)}
                >
                  <ExpoImage
                    source={{ uri: url }}
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 12,
                      backgroundColor: theme.colors.surface2,
                    }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              ))}
            </ScrollView>
          )}

          {persona.bio && (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>
                {t('topics.about')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: theme.colors.text2 }}>
                {persona.bio}
              </Text>
            </View>
          )}

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

          {/* Bottom CTA. Self → edit own photos (the unlock-request flow makes
              no sense for yourself). Others → request cross-topic unlock when
              not yet granted. */}
          {isSelf ? (
            <View style={{ marginTop: 24, marginBottom: 8 }}>
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
            <View style={{ marginTop: 24, marginBottom: 8 }}>
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
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700' },
  centered: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
});
