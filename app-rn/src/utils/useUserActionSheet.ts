import React from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { nativeActionSheet } from '../../modules/native-sheet';
import { deferOpen } from './deferOpen';
import { toggleFollow } from '../api/follows';
import { openConversation } from '../api/chats';
import { useAuth } from '../store/auth';
import type { RootStackParamList } from '../navigation/types';

/**
 * Shared "tap a user → 查看资料 / 添加好友 / 发私信" native action sheet, used by the
 * world-chat roster sheet, the online avatar strip, and the full online-users
 * screen. Presented via deferOpen (runAfterInteractions + rAF) so the sheet never
 * opens mid-gesture (Android-15 fly-up guard). Skips self. add-friend = toggleFollow
 * (idempotent); we read the returned state for the toast.
 */
export function useUserActionSheet() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const me = useAuth((s) => s.user);
  const myId = String((me as any)?.id ?? (me as any)?._id ?? '');

  return React.useCallback(
    (userId: string) => {
      const targetId = String(userId ?? '');
      if (!targetId || targetId === myId) return;
      deferOpen(async () => {
        const viewProfile = t('worldChat.viewProfile');
        const addFriend = t('worldChat.addFriend');
        const dm = t('worldChat.dm');
        const cancel = t('common.cancel');
        const options = [viewProfile, addFriend, dm, cancel];
        const i = await nativeActionSheet({ options, cancelIndex: options.length - 1 });
        if (i < 0) return;
        const picked = options[i];
        if (picked === viewProfile) {
          nav.navigate('UserDetail', { userId: targetId });
        } else if (picked === addFriend) {
          try {
            const { following } = await toggleFollow(targetId);
            Alert.alert(following ? t('worldChat.friendAdded') : t('worldChat.friendRemoved'));
          } catch {
            Alert.alert(t('worldChat.actionFailed'));
          }
        } else if (picked === dm) {
          try {
            const res = await openConversation(targetId);
            qc.invalidateQueries({ queryKey: ['chats', 'list'] });
            nav.navigate('ChatDetail', { chatId: res.matchId });
          } catch (e: any) {
            if (e?.response?.status === 402) nav.navigate('Premium');
            else Alert.alert(t('worldChat.actionFailed'), e?.response?.data?.error ?? '');
          }
        }
      });
    },
    [myId, nav, t, qc],
  );
}
