import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MoreHorizontal } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { TagChip } from '../../components/TagChip';
import { Card } from '../../components/Card';
import { tagById, type InterestTagId } from '../../data/interestTags';
import { getUserById } from '../../api/me';
import { showSafetyMenu } from '../../utils/safetyMenu';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'UserDetail'>;
type Rt = RouteProp<RootStackParamList, 'UserDetail'>;

/**
 * Full-page profile view for another user. Reached today from the chat
 * header avatar/name tap; reusable from anywhere we want to show a user
 * outside the Discover swipe deck or AboutUserSheet.
 *
 * Shows: avatar, nickname, age, online state, bio, interests, prompts.
 * Action: safety menu (report/block).
 */
export function UserDetailScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { userId } = route.params;

  const userQ = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserById(userId),
    staleTime: 60_000,
  });

  const user = userQ.data;

  const onMore = () => {
    if (!user) return;
    showSafetyMenu({
      userId,
      userName: user.nickname,
      nav,
      // Coming from outside a chat context — no unmatch action.
      includeUnmatch: false,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {user && (
          <Pressable
            onPress={onMore}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: theme.colors.surface2,
            }}
          >
            <MoreHorizontal size={18} color={theme.colors.text} strokeWidth={1.6} />
          </Pressable>
        )}
      </View>

      {userQ.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {userQ.isError && (
        <View style={styles.center}>
          <Text style={{ color: theme.colors.muted }}>{t('userDetail.loadFailed')}</Text>
        </View>
      )}

      {user && (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHeader}>
            <Avatar
              name={user.nickname}
              uri={user.avatarUrl}
              avatarIdx={idxFor(userId)}
              size={92}
              shape="circle"
              showOnline={user.isOnline}
            />
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {user.nickname}
              {user.age ? ` · ${user.age}` : ''}
            </Text>
            {user.countryCode && (
              <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 4 }}>
                {user.countryCode}
              </Text>
            )}
          </View>

          {user.prompts && user.prompts.length > 0 && (
            <Card surface2 flat style={{ padding: 14, marginTop: 18 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 12, marginBottom: 6 }}>
                {user.prompts[0].q}
              </Text>
              <Text
                style={{
                  fontFamily: 'Fraunces',
                  fontStyle: 'italic',
                  fontSize: 15,
                  lineHeight: 23,
                  color: theme.colors.text,
                  fontWeight: '500',
                }}
              >
                &ldquo;{user.prompts[0].a}&rdquo;
              </Text>
            </Card>
          )}

          {user.bio ? (
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>
                {t('userDetail.aboutSection')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: theme.colors.text2 }}>
                {user.bio}
              </Text>
            </View>
          ) : null}

          {user.interests && user.interests.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>
                {t('userDetail.interestsSection')}
              </Text>
              <View style={styles.tagsRow}>
                {(user.interests as InterestTagId[]).map((id) => {
                  const tag = tagById(id);
                  if (!tag) return null;
                  return <TagChip key={id} tag={tag} />;
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Deterministic avatar gradient index based on userId — same algorithm
 *  the discover cards use so the same user gets the same color
 *  everywhere. Lifted from chats/ChatDetailScreen so it stays consistent. */
function idxFor(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
  },
  section: {
    fontSize: 12,
    letterSpacing: 0.72,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
