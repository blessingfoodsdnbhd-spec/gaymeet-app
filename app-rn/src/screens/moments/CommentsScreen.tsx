import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components/EmptyState';
import { ChatComposer } from '../../components/ChatComposer';
import { PhotoConfirmModal } from '../../components/PhotoConfirmModal';
import { CommentCard } from '../../components/comments/CommentCard';
import { uploadFile } from '../../api/upload';
import { getComments, postComment, type Comment } from '../../api/moments';
import { useAuth } from '../../store/auth';
import { showSafetyMenu } from '../../utils/safetyMenu';
import type { RootStackParamList } from '../../navigation/types';

type Rt = RouteProp<RootStackParamList, 'Comments'>;

export function CommentsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const route = useRoute<Rt>();
  const { momentId, authorId } = route.params;
  const queryClient = useQueryClient();
  const myId = useAuth((s) => s.user?.id);

  const [draft, setDraft] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const commentsQ = useQuery({
    queryKey: ['moments', 'comments', momentId],
    queryFn: () => getComments(momentId),
  });

  // Group the flat (newest-first) list into top-level comments + replies.
  const { topLevel, repliesByParent } = useMemo(() => {
    const all = commentsQ.data ?? [];
    const replies = new Map<string, Comment[]>();
    const tops: Comment[] = [];
    for (const c of all) {
      // Backend `isAuthor` is source of truth; fall back to the nav param.
      const withAuthor =
        c.isAuthor || (!!authorId && c.user._id === authorId) ? { ...c, isAuthor: true } : c;
      if (c.parentComment) {
        const arr = replies.get(c.parentComment) ?? [];
        arr.push(withAuthor);
        replies.set(c.parentComment, arr);
      } else {
        tops.push(withAuthor);
      }
    }
    // Replies read oldest→newest within a thread.
    for (const arr of replies.values()) {
      arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    }
    return { topLevel: tops, repliesByParent: replies };
  }, [commentsQ.data, authorId]);

  const postMut = useMutation({
    mutationFn: async (vars: {
      content: string;
      photoUri: string | null;
      parentCommentId?: string;
    }) => {
      let photoUrl: string | undefined;
      if (vars.photoUri) photoUrl = await uploadFile(vars.photoUri);
      return postComment(momentId, {
        content: vars.content || undefined,
        photoUrl,
        parentCommentId: vars.parentCommentId,
      });
    },
    onSuccess: (real, vars) => {
      // Backend is newest-first → prepend.
      queryClient.setQueryData<Comment[]>(['moments', 'comments', momentId], (prev) =>
        prev ? [real, ...prev] : [real],
      );
      if (vars.parentCommentId) {
        setExpanded((s) => new Set(s).add(vars.parentCommentId!));
      }
      // Bump the comment counter on this moment wherever it's cached.
      queryClient.setQueriesData<any>({ queryKey: ['moments'] }, (data: any) => {
        if (!data) return data;
        const bump = (m: any) =>
          m && m._id === momentId ? { ...m, commentCount: (m.commentCount ?? 0) + 1 } : m;
        if (Array.isArray(data)) return data.map(bump);
        if (data._id === momentId) return bump(data);
        return data;
      });
    },
    onError: (e: any, vars) => {
      // Restore draft / photo so the user can retry.
      if (!vars.photoUri) setDraft(vars.content);
      else setPendingPhoto(vars.photoUri);
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('moments.comments.sendFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    },
  });

  // Resolve the top-level ancestor so replies stay one level deep.
  const parentIdOf = (c: Comment | null) => (c ? c.parentComment || c._id : undefined);

  const onSendText = (text: string) => {
    const v = text.trim();
    if (!v) return;
    const parentCommentId = parentIdOf(replyTo);
    setDraft('');
    setReplyTo(null);
    postMut.mutate({ content: v, photoUri: null, parentCommentId });
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('profile.edit.photoPermTitle'), t('profile.edit.photoPermBody'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: Platform.OS === 'android',
      quality: 0.85,
    });
    if (!res.canceled) setPendingPhoto(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('chat.composer.cameraPermTitle'), t('chat.composer.cameraPermBody'));
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: Platform.OS === 'android',
      quality: 0.85,
    });
    if (!res.canceled) setPendingPhoto(res.assets[0].uri);
  };

  const confirmSendPhoto = (caption: string) => {
    const uri = pendingPhoto;
    setPendingPhoto(null);
    if (!uri) return;
    const parentCommentId = parentIdOf(replyTo);
    setReplyTo(null);
    postMut.mutate({ content: caption.trim(), photoUri: uri, parentCommentId });
  };

  const onTapAuthor = (userId: string) => (nav as any).navigate('UserDetail', { userId });

  // Long-press a comment → report/block its author (Apple 1.2 — every UGC
  // surface needs a report path). Skipped for the viewer's own comments.
  const onReport = (c: Comment) => {
    if (c.user._id === myId) return;
    showSafetyMenu({
      nav: nav as any,
      userId: c.user._id,
      userName: c.user.nickname,
    });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      edges={['top', 'bottom']}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('moments.comments.title')}
        </Text>
      </View>

      <KeyboardAvoidingView
        // Mirror ChatDetailScreen: behavior=undefined on Android (esp. under the
        // forced edge-to-edge of API 35) drifts the composer out of place and
        // leaves it hidden behind the keyboard. "height" + a 0 offset lets the
        // system adjustResize position the input correctly across phone/tablet.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {commentsQ.isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : commentsQ.isError ? (
          <View style={styles.centerFill}>
            <Text style={{ color: theme.colors.muted, fontSize: 14, marginBottom: 12 }}>
              {t('moments.comments.loadFailed')}
            </Text>
            <Pressable
              onPress={() => commentsQ.refetch()}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 9,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.colors.line,
              }}
            >
              <Text style={{ color: theme.colors.text, fontSize: 13.5 }}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : topLevel.length === 0 ? (
          <View style={styles.centerFill}>
            <EmptyState
              emoji="💬"
              title={t('moments.comments.emptyTitle')}
              subtitle={t('moments.comments.emptySubtitle')}
            />
          </View>
        ) : (
          <FlatList
            data={topLevel}
            keyExtractor={(c) => c._id}
            contentContainerStyle={{ paddingVertical: 4 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const replies = repliesByParent.get(item._id) ?? [];
              const isOpen = expanded.has(item._id);
              return (
                <View>
                  <CommentCard comment={item} onReply={setReplyTo} onTapAuthor={onTapAuthor} onReport={onReport} />
                  {replies.length > 0 && (
                    <Pressable
                      onPress={() =>
                        setExpanded((s) => {
                          const n = new Set(s);
                          isOpen ? n.delete(item._id) : n.add(item._id);
                          return n;
                        })
                      }
                      hitSlop={6}
                      style={styles.repliesToggle}
                    >
                      <View style={[styles.replyDash, { backgroundColor: theme.colors.line }]} />
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.colors.text2 }}>
                        {isOpen
                          ? t('moments.comments.hideReplies')
                          : t('moments.comments.viewReplies', { n: replies.length })}
                      </Text>
                    </Pressable>
                  )}
                  {isOpen &&
                    replies.map((r) => (
                      <CommentCard
                        key={r._id}
                        comment={r}
                        isReply
                        onReply={setReplyTo}
                        onTapAuthor={onTapAuthor}
                        onReport={onReport}
                      />
                    ))}
                </View>
              );
            }}
          />
        )}

        {/* WhatsApp-style composer (mic hidden — no voice handlers passed) */}
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={onSendText}
          onPickPhotoFromLibrary={pickFromLibrary}
          onTakePhoto={takePhoto}
          placeholder={t('moments.comments.placeholder')}
          maxLength={200}
          replyTo={
            replyTo
              ? { id: replyTo._id, text: replyTo.content || '📷', name: replyTo.user.nickname }
              : null
          }
          onCancelReply={() => setReplyTo(null)}
        />
      </KeyboardAvoidingView>

      <PhotoConfirmModal
        uri={pendingPhoto}
        open={!!pendingPhoto}
        sending={postMut.isPending}
        onCancel={() => setPendingPhoto(null)}
        onSend={confirmSendPhoto}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  repliesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 64,
    paddingVertical: 6,
  },
  replyDash: { width: 22, height: StyleSheet.hairlineWidth },
});
