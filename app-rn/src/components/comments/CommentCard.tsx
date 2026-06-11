import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ThumbsUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../Avatar';
import { shortTime } from '../../utils/time';
import {
  reactToComment,
  removeCommentReaction,
  type Comment,
} from '../../api/moments';
import { ReactionTray } from './ReactionTray';

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/** Apply a reaction toggle to a comment optimistically (one reaction per user). */
function applyReaction(c: Comment, emoji: string): Comment {
  const cur = c.myReaction || null;
  const reactions = { ...c.reactions };
  let count = c.reactionCount;
  let mine: string | null = cur;
  if (cur) {
    reactions[cur] = (reactions[cur] || 1) - 1;
    if (reactions[cur] <= 0) delete reactions[cur];
    count -= 1;
    mine = null;
  }
  if (cur !== emoji) {
    reactions[emoji] = (reactions[emoji] || 0) + 1;
    count += 1;
    mine = emoji;
  }
  return { ...c, reactions, myReaction: mine, reactionCount: count };
}

/** Top-3 emoji by count, for the "👍❤️😂 12" summary. */
function topEmojis(reactions: Record<string, number>): string[] {
  return Object.entries(reactions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([e]) => e);
}

export function CommentCard({
  comment,
  momentId,
  isReply = false,
  onReply,
  onTapAuthor,
}: {
  comment: Comment;
  momentId: string;
  isReply?: boolean;
  onReply?: (c: Comment) => void;
  onTapAuthor?: (userId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [trayOpen, setTrayOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const reactMut = useMutation({
    mutationFn: ({ emoji, isRemoval }: { emoji: string; isRemoval: boolean }) =>
      isRemoval
        ? removeCommentReaction(momentId, comment._id)
        : reactToComment(momentId, comment._id, emoji),
    onMutate: ({ emoji }) => {
      // Optimistically update every cached sort variant for this moment.
      const patch = (c: Comment) => (c._id === comment._id ? applyReaction(c, emoji) : c);
      queryClient.setQueriesData<Comment[]>({ queryKey: ['moments', 'comments', momentId] }, (prev) =>
        prev ? prev.map(patch) : prev,
      );
    },
    onSuccess: (server) => {
      queryClient.setQueriesData<Comment[]>({ queryKey: ['moments', 'comments', momentId] }, (prev) =>
        prev ? prev.map((c) => (c._id === server._id ? { ...c, ...server } : c)) : prev,
      );
    },
    onError: () => {
      // Roll back to server truth.
      queryClient.invalidateQueries({ queryKey: ['moments', 'comments', momentId] });
    },
  });

  const handleReact = (emoji: string) => {
    reactMut.mutate({ emoji, isRemoval: comment.myReaction === emoji });
  };

  const top = topEmojis(comment.reactions);
  const liked = !!comment.myReaction;

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

        {/* Footer: react summary + react button + reply */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => handleReact('👍')}
            onLongPress={() => setTrayOpen(true)}
            delayLongPress={220}
            hitSlop={6}
            style={styles.footerBtn}
          >
            {liked ? (
              <Text style={{ fontSize: 15 }}>{comment.myReaction}</Text>
            ) : (
              <ThumbsUp size={15} color={theme.colors.muted} strokeWidth={1.8} />
            )}
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: liked ? theme.colors.primary : theme.colors.muted,
              }}
            >
              {t('moments.comments.reaction.like')}
            </Text>
          </Pressable>

          <Pressable onPress={() => onReply?.(comment)} hitSlop={6} style={styles.footerBtn}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.colors.muted }}>
              {t('moments.comments.reply')}
            </Text>
          </Pressable>

          {comment.reactionCount > 0 && (
            <View style={styles.summary}>
              <Text style={{ fontSize: 13 }}>{top.join('')}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.muted, marginLeft: 3 }}>
                {comment.reactionCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Long-press reaction tray, anchored above the footer */}
      {trayOpen && (
        <>
          <Pressable style={styles.trayBackdrop} onPress={() => setTrayOpen(false)} />
          <View style={styles.trayAnchor} pointerEvents="box-none">
            <ReactionTray onPick={handleReact} onClose={() => setTrayOpen(false)} />
          </View>
        </>
      )}

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
  footer: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 6 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summary: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  trayBackdrop: { ...StyleSheet.absoluteFillObject },
  trayAnchor: { position: 'absolute', left: 56, bottom: 36 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '100%' },
});
