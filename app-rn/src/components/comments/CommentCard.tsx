import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../Avatar';
import { shortTime } from '../../utils/time';
import { type Comment } from '../../api/moments';

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

export function CommentCard({
  comment,
  isReply = false,
  onReply,
  onTapAuthor,
}: {
  comment: Comment;
  isReply?: boolean;
  onReply?: (c: Comment) => void;
  onTapAuthor?: (userId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [photoOpen, setPhotoOpen] = useState(false);

  return (
    <View style={[styles.row, { paddingLeft: isReply ? 16 : 20 }]}>
      {isReply && <View style={[styles.threadLine, { backgroundColor: theme.colors.line }]} />}
      <Pressable onPress={() => onTapAuthor?.(comment.user._id)} hitSlop={4}>
        <Avatar
          name={comment.user.nickname}
          uri={comment.user.avatarUrl}
          avatarIdx={idxFor(comment.user._id)}
          size={isReply ? 28 : 34}
        />
      </Pressable>

      <View style={{ flex: 1 }}>
        {/* Name + author badge + time */}
        <View style={styles.nameRow}>
          <Pressable onPress={() => onTapAuthor?.(comment.user._id)} hitSlop={4}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>
              {comment.user.nickname}
            </Text>
          </Pressable>
          {comment.isAuthor && (
            <View style={[styles.authorBadge, { backgroundColor: theme.colors.primarySoft }]}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.primaryDeep }}>
                {t('moments.comments.author')}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 11, color: theme.colors.muted }}>
            {shortTime(comment.createdAt)}
          </Text>
        </View>

        {/* Text */}
        {!!comment.content && (
          <Text style={{ fontSize: 14, color: theme.colors.text, marginTop: 3, lineHeight: 20 }}>
            {comment.content}
          </Text>
        )}

        {/* Photo */}
        {!!comment.photoUrl && (
          <Pressable onPress={() => setPhotoOpen(true)} style={{ marginTop: 6 }}>
            <Image
              source={{ uri: comment.photoUrl }}
              style={[styles.photo, { backgroundColor: theme.colors.surface2 }]}
              contentFit="cover"
            />
          </Pressable>
        )}

        {/* Reply */}
        <Pressable onPress={() => onReply?.(comment)} hitSlop={6} style={styles.replyBtn}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.colors.muted }}>
            {t('moments.comments.reply')}
          </Text>
        </Pressable>
      </View>

      {/* Full-screen photo viewer */}
      <Modal visible={photoOpen} transparent animationType="fade" onRequestClose={() => setPhotoOpen(false)}>
        <Pressable style={styles.viewer} onPress={() => setPhotoOpen(false)}>
          {!!comment.photoUrl && (
            <Image source={{ uri: comment.photoUrl }} style={styles.viewerImg} contentFit="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingRight: 20, paddingVertical: 10 },
  threadLine: {
    position: 'absolute',
    left: 0,
    top: -10,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  photo: { width: 160, height: 160, borderRadius: 14 },
  replyBtn: { marginTop: 6, alignSelf: 'flex-start' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '100%' },
});
