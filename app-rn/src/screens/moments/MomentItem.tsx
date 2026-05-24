import React from 'react';
import { View, Text, Pressable, Image, useWindowDimensions, StyleSheet } from 'react-native';
import { Heart, MessageSquare, MoreHorizontal } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { Chip } from '../../components/Chip';
import { tagById } from '../../data/interestTags';
import { shortTime } from '../../utils/time';
import { showSafetyMenu } from '../../utils/safetyMenu';
import type { Moment } from '../../api/moments';

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
  const { i18n } = useTranslation();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const photos = moment.images ?? [];
  const tag = moment.tag ? tagById(moment.tag) : null;
  const tagLabel = tag ? (i18n.language?.startsWith('zh') ? tag.zh : tag.en) : '';

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
          <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
            {moment.user.nickname}
          </Text>
          <Text style={{ color: theme.colors.muted, fontSize: 11.5, marginTop: 2 }}>
            {shortTime(moment.createdAt)}
            {moment.user.countryCode ? ` · ${moment.user.countryCode}` : ''}
          </Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() =>
            showSafetyMenu({
              userId: moment.user._id,
              userName: moment.user.nickname,
              nav: nav as any,
            })
          }
        >
          <MoreHorizontal size={20} color={theme.colors.muted} strokeWidth={1.6} />
        </Pressable>
      </View>

      {moment.content ? (
        <Text style={[styles.content, { color: theme.colors.text }]}>{moment.content}</Text>
      ) : null}

      {photos.length > 0 && <PhotoGrid photos={photos} maxWidth={width - 40} />}

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

function PhotoGrid({ photos, maxWidth }: { photos: string[]; maxWidth: number }) {
  if (photos.length === 1) {
    return (
      <Image
        source={{ uri: photos[0] }}
        style={{
          width: maxWidth,
          height: 220,
          borderRadius: 14,
          marginHorizontal: 20,
          marginTop: 12,
        }}
      />
    );
  }
  const cols = photos.length === 2 ? 2 : 3;
  const gap = 4;
  const tileW = (maxWidth - gap * (cols - 1)) / cols;
  return (
    <View
      style={{
        marginTop: 12,
        marginHorizontal: 20,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap,
      }}
    >
      {photos.slice(0, 9).map((p, i) => (
        <Image
          key={i}
          source={{ uri: p }}
          style={{ width: tileW, height: tileW, borderRadius: 8 }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
