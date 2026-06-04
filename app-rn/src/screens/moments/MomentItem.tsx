import React from 'react';
import { View, Text, Pressable, useWindowDimensions, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Heart, MessageSquare, MoreHorizontal } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { usePhotoViewer } from '../../components/usePhotoViewer';
import { Chip } from '../../components/Chip';
import { tagById } from '../../data/interestTags';
import { shortTime } from '../../utils/time';
import { showSafetyMenu } from '../../utils/safetyMenu';
import { useAuth } from '../../store/auth';
import { deleteMoment, type Moment } from '../../api/moments';

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

interface Props {
  moment: Moment;
  onToggleLike: (m: Moment) => void;
  onTapAuthor?: (m: Moment) => void;
  onOpenComments?: (m: Moment) => void;
}

export function MomentItem({ moment, onToggleLike, onTapAuthor, onOpenComments }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const me = useAuth((s) => s.user);
  const queryClient = useQueryClient();
  const photoViewer = usePhotoViewer();
  const photos = moment.images ?? [];
  const tag = moment.tag ? tagById(moment.tag) : null;
  const tagLabel = tag ? (i18n.language?.startsWith('zh') ? tag.zh : tag.en) : '';
  const isMine = !!me && moment.user._id === me.id;

  // Soft-delete the moment. Optimistically removes the row from every
  // moments query in the cache (MomentsScreen's ['moments', filter] and
  // MyMomentsScreen's ['moments', 'user', userId]) so the FlatList
  // updates immediately. Rolls back on failure. Refreshes the profile
  // stats so the 动态 counter drops by one.
  const deleteMut = useMutation({
    mutationFn: () => deleteMoment(moment._id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['moments'] });
      const entries = queryClient.getQueriesData<Moment[]>({ queryKey: ['moments'] });
      queryClient.setQueriesData<Moment[]>(
        { queryKey: ['moments'] },
        (prev) => (prev ?? []).filter((m) => m._id !== moment._id),
      );
      return { entries };
    },
    onError: (_e, _vars, ctx) => {
      // Restore every snapshot we touched.
      ctx?.entries.forEach(([key, data]) => queryClient.setQueryData(key, data));
      Alert.alert(t('moments.delete.failed'));
    },
    onSettled: () => {
      // Profile stat counter & comments query freshness.
      queryClient.invalidateQueries({ queryKey: ['me', 'stats'] });
    },
  });

  const onMore = () => {
    if (isMine) {
      Alert.alert(
        t('moments.delete.title'),
        t('moments.delete.body'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('moments.delete.action'),
            style: 'destructive',
            onPress: () => deleteMut.mutate(),
          },
        ],
      );
    } else {
      showSafetyMenu({
        userId: moment.user._id,
        userName: moment.user.nickname,
        nav: nav as any,
      });
    }
  };

  return (
    <View style={[styles.wrap, { borderBottomColor: theme.colors.line }]}>
      <View style={styles.header}>
        <Pressable onPress={() => onTapAuthor?.(moment)}>
          <Avatar
            name={moment.user.nickname}
            uri={moment.user.avatarUrl}
            avatarIdx={idxFor(moment.user._id)}
            size={40}
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => onTapAuthor?.(moment)} hitSlop={4}>
            <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
              {moment.user.nickname}
            </Text>
          </Pressable>
          <Text style={{ color: theme.colors.muted, fontSize: 11.5, marginTop: 2 }}>
            {shortTime(moment.createdAt)}
            {moment.user.countryCode ? ` · ${moment.user.countryCode}` : ''}
          </Text>
        </View>
        <Pressable hitSlop={8} onPress={onMore}>
          <MoreHorizontal size={20} color={theme.colors.muted} strokeWidth={1.6} />
        </Pressable>
      </View>

      {moment.content ? (
        // Wrap the caption in its own View. Under the New Architecture
        // (Fabric/Bridgeless, which this project has on) a bare <Text>
        // sandwiched between two layout-changing siblings (header above,
        // image below) sometimes has its glyph bounding box mis-measured
        // when the image's intrinsic size resolves after the first paint —
        // visible as the second half of the caption getting clipped.
        // An isolating View pins the text's own layout box so the image's
        // reflow can't shift it.
        <View style={styles.contentWrap}>
          <Text style={[styles.content, { color: theme.colors.text }]}>
            {moment.content}
          </Text>
        </View>
      ) : null}

      {photos.length > 0 && (
        <View style={styles.photoArea}>
          <PhotoGrid
            photos={photos}
            maxWidth={width - 40}
            onPhotoPress={(i) => photoViewer.open(photos, i)}
          />
        </View>
      )}

      {tag && (
        <View style={{ marginTop: 12, paddingHorizontal: 20 }}>
          <Chip label={`${tag.emoji} ${tagLabel}`} variant="solid" />
        </View>
      )}

      <View style={styles.actions}>
        <Action
          icon={
            <Heart
              size={20}
              color={moment.isLiked ? theme.colors.accentRose : theme.colors.muted}
              fill={moment.isLiked ? theme.colors.accentRose : 'transparent'}
              strokeWidth={1.8}
            />
          }
          count={moment.likeCount}
          onPress={() => onToggleLike(moment)}
          highlighted={moment.isLiked}
        />
        <Action
          icon={<MessageSquare size={20} color={theme.colors.muted} strokeWidth={1.8} />}
          count={moment.commentCount ?? 0}
          onPress={() => onOpenComments?.(moment)}
        />
      </View>
      {photoViewer.node}
    </View>
  );
}

function Action({
  icon,
  count,
  highlighted,
  onPress,
}: {
  icon: React.ReactNode;
  count?: number;
  highlighted?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon}
      {count != null && (
        <Text
          style={{
            fontSize: 13,
            color: highlighted ? theme.colors.accentRose : theme.colors.muted,
            fontVariant: ['tabular-nums'],
          }}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}

function PhotoGrid({
  photos,
  maxWidth,
  onPhotoPress,
}: {
  photos: string[];
  maxWidth: number;
  onPhotoPress: (index: number) => void;
}) {
  // Use explicit pixel width AND pixel height — no aspectRatio. With
  // aspectRatio, expo-image (and RN Image) report height = 0 before the
  // source loads, then expand to (width * 3/4) once the intrinsic size
  // is known. That late expansion was kicking the FlatList row's
  // measurement and (under Fabric) clipping the caption above to half
  // its rendered height. Fixed pixel dimensions reserve the right space
  // from the very first paint — no reflow, no caption clipping.
  if (photos.length === 1) {
    return (
      <Pressable onPress={() => onPhotoPress(0)}>
        <Image
          source={{ uri: photos[0] }}
          style={{
            width: maxWidth,
            height: 240,
            borderRadius: 14,
          }}
          contentFit="cover"
          transition={150}
        />
      </Pressable>
    );
  }
  const cols = photos.length === 2 ? 2 : 3;
  const gap = 4;
  const tileW = (maxWidth - gap * (cols - 1)) / cols;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap,
      }}
    >
      {photos.slice(0, 9).map((p, i) => (
        <Pressable key={i} onPress={() => onPhotoPress(i)}>
          <Image
            source={{ uri: p }}
            style={{ width: tileW, height: tileW, borderRadius: 8 }}
            contentFit="cover"
            transition={150}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // Do NOT set overflow: 'hidden' here — it clips the caption Text's
    // glyph bounding box under Fabric (visible as the lower half of the
    // line getting cut off). The earlier 60788a2 commit added it as
    // defense, but it caused the very bug we were trying to prevent.
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  contentWrap: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  content: {
    fontSize: 15,
    // No explicit lineHeight — let the font's intrinsic line-height
    // win. Pinning lineHeight on iOS + Fabric was clipping the second
    // half of CJK glyphs that have descenders extending past the line
    // box. Captions wrap to any length the user wrote; no maxHeight,
    // no numberOfLines.
  },
  photoArea: {
    marginTop: 12,
    marginHorizontal: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
