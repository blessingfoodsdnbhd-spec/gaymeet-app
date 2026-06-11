import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, Send, Image as ImageIcon, X } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components/EmptyState';
import { Sheet } from '../../components/Sheet';
import { CommentCard } from '../../components/comments/CommentCard';
import { uploadFile } from '../../api/upload';
import {
  getComments,
  postComment,
  type Comment,
  type CommentSort,
} from '../../api/moments';
import type { RootStackParamList } from '../../navigation/types';

type Rt = RouteProp<RootStackParamList, 'Comments'>;

const SORTS: CommentSort[] = ['relevant', 'newest', 'oldest'];

export function CommentsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const route = useRoute<Rt>();
  const { momentId, authorId } = route.params;
  const queryClient = useQueryClient();

  const [sort, setSort] = useState<CommentSort>('relevant');
  const [sortOpen, setSortOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  const commentsQ = useQuery({
    queryKey: ['moments', 'comments', momentId, sort],
    queryFn: () => getComments(momentId, sort),
  });

  // Group the flat list into top-level comments + replies (one level deep).
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
      // Append to every cached sort variant so it shows immediately.
      queryClient.setQueriesData<Comment[]>({ queryKey: ['moments', 'comments', momentId] }, (prev) =>
        prev ? [...prev, real] : [real],
      );
      // Auto-expand the parent thread so a new reply is visible.
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
      // Restore draft + photo so the user can retry without re-entering.
      setDraft(vars.content);
      setPendingPhoto(vars.photoUri);
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('moments.comments.sendFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    },
  });

  const onSend = () => {
    const text = draft.trim();
    if (!text && !pendingPhoto) return;
    // Replies flatten to one level: anchor to the top-level ancestor.
    const parentCommentId = replyTo ? replyTo.parentComment || replyTo._id : undefined;
    setDraft('');
    setPendingPhoto(null);
    setReplyTo(null);
    postMut.mutate({ content: text, photoUri: pendingPhoto, parentCommentId });
  };

  const pickPhoto = async () => {
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
    if (res.canceled) return;
    setPendingPhoto(res.assets[0].uri);
  };

  const startReply = (c: Comment) => {
    setReplyTo(c);
    inputRef.current?.focus();
  };

  const onTapAuthor = (userId: string) => (nav as any).navigate('UserDetail', { userId });

  const canSend = (!!draft.trim() || !!pendingPhoto) && !postMut.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          {t('moments.comments.title')}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Sort chip */}
        <View style={styles.sortBar}>
          <Pressable
            onPress={() => setSortOpen(true)}
            style={[styles.sortChip, { backgroundColor: theme.colors.surface2 }]}
            hitSlop={6}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text2 }}>
              {t(`moments.comments.sort.${sort}`)}
            </Text>
            <ChevronDown size={15} color={theme.colors.text2} />
          </Pressable>
        </View>

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
                  <CommentCard
                    comment={item}
                    momentId={momentId}
                    onReply={startReply}
                    onTapAuthor={onTapAuthor}
                  />
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
                        momentId={momentId}
                        isReply
                        onReply={startReply}
                        onTapAuthor={onTapAuthor}
                      />
                    ))}
                </View>
              );
            }}
          />
        )}

        {/* Composer */}
        <View
          style={[
            styles.composerWrap,
            { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line },
          ]}
        >
          {replyTo && (
            <View style={[styles.replyChip, { backgroundColor: theme.colors.surface2 }]}>
              <Text style={{ fontSize: 12.5, color: theme.colors.text2, flex: 1 }} numberOfLines={1}>
                {t('moments.comments.replyingTo', { name: replyTo.user.nickname })}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <X size={16} color={theme.colors.muted} />
              </Pressable>
            </View>
          )}
          {pendingPhoto && (
            <View style={styles.photoPreview}>
              <ExpoImage source={{ uri: pendingPhoto }} style={styles.previewImg} contentFit="cover" />
              <Pressable
                onPress={() => setPendingPhoto(null)}
                style={[styles.previewX, { backgroundColor: theme.colors.text }]}
                hitSlop={8}
              >
                <X size={13} color="#FFFFFF" strokeWidth={2.5} />
              </Pressable>
            </View>
          )}
          <View style={styles.composer}>
            <Pressable onPress={pickPhoto} hitSlop={8} style={{ padding: 4 }}>
              <ImageIcon size={24} color={theme.colors.primary} />
            </Pressable>
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: theme.colors.line,
                paddingHorizontal: 14,
                paddingVertical: 8,
                minHeight: 40,
              }}
            >
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder={t('moments.comments.placeholder')}
                placeholderTextColor={theme.colors.muted}
                multiline
                maxLength={200}
                style={{
                  fontSize: 14,
                  color: theme.colors.text,
                  paddingVertical: 4,
                  minHeight: 24,
                  maxHeight: 100,
                }}
              />
            </View>
            <Pressable
              onPress={onSend}
              disabled={!canSend}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: canSend ? theme.colors.primary : theme.colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {postMut.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={18} color={canSend ? '#FFFFFF' : theme.colors.muted} strokeWidth={2} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Sort menu */}
      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} maxHeight="40%">
        <View style={{ paddingBottom: 8 }}>
          {SORTS.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setSort(s);
                setSortOpen(false);
              }}
              style={styles.sortRow}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: s === sort ? '700' : '400',
                  color: s === sort ? theme.colors.primary : theme.colors.text,
                }}
              >
                {t(`moments.comments.sort.${s}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
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
  sortBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2 },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
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
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  photoPreview: { marginHorizontal: 14, marginTop: 8, width: 72, height: 72 },
  previewImg: { width: 72, height: 72, borderRadius: 12 },
  previewX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRow: { paddingVertical: 14, paddingHorizontal: 20 },
});
