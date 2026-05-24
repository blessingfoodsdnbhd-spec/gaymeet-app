import React, { useState } from 'react';
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
import { ChevronLeft, Send } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import {
  getComments,
  postComment,
  type Comment,
} from '../../api/moments';
import { shortTime } from '../../utils/time';
import type { RootStackParamList } from '../../navigation/types';

type Rt = RouteProp<RootStackParamList, 'Comments'>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

export function CommentsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const route = useRoute<Rt>();
  const { momentId } = route.params;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const commentsQ = useQuery({
    queryKey: ['moments', 'comments', momentId],
    queryFn: () => getComments(momentId),
  });

  const postMut = useMutation({
    mutationFn: (content: string) => postComment(momentId, content),
    onSuccess: (real) => {
      queryClient.setQueryData<Comment[]>(['moments', 'comments', momentId], (prev) => [
        ...(prev ?? []),
        real,
      ]);
    },
    onError: (e: any, content) => {
      // Restore the draft so the user can retry without retyping.
      setDraft(content);
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('moments.comments.sendFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    },
  });

  const onSend = () => {
    const v = draft.trim();
    if (!v) return;
    setDraft('');
    postMut.mutate(v);
  };

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
        ) : (
          <FlatList
            data={commentsQ.data ?? []}
            keyExtractor={(c) => c._id}
            contentContainerStyle={{ paddingVertical: 8 }}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.line,
                  marginLeft: 60,
                }}
              />
            )}
            renderItem={({ item }) => <CommentRow comment={item} />}
            ListEmptyComponent={
              <View style={styles.centerFill}>
                <Text style={{ color: theme.colors.muted, fontSize: 14 }}>{t('moments.comments.empty')}</Text>
              </View>
            }
          />
        )}

        <View style={[styles.composer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line }]}>
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
            disabled={!draft.trim() || postMut.isPending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: draft.trim() ? theme.colors.primary : theme.colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Send size={18} color={draft.trim() ? '#FFFFFF' : theme.colors.muted} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
      }}
    >
      <Avatar
        name={comment.user.nickname}
        uri={comment.user.avatarUrl}
        avatarIdx={idxFor(comment.user._id)}
        size={36}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>
          {comment.user.nickname}
        </Text>
        <Text style={{ fontSize: 14, color: theme.colors.text, marginTop: 4, lineHeight: 20 }}>
          {comment.content}
        </Text>
        <Text style={{ fontSize: 11, color: theme.colors.muted, marginTop: 4 }}>
          {shortTime(comment.createdAt)}
        </Text>
      </View>
    </View>
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
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
