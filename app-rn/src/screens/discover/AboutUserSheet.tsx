import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Heart, MoreHorizontal, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

import { Sheet } from '../../components/Sheet';
import { Avatar } from '../../components/Avatar';
import { TagChip } from '../../components/TagChip';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/TopBar';
import { Card } from '../../components/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { tagById, type InterestTagId } from '../../data/interestTags';
import type { DiscoverCardUser } from '../../api/discover';
import type { RootStackParamList } from '../../navigation/types';
import { showSafetyMenu } from '../../utils/safetyMenu';

interface Props {
  open: boolean;
  user: DiscoverCardUser | null;
  onClose: () => void;
  onLike: () => void;
}

export function AboutUserSheet({ open, user, onClose, onLike }: Props) {
  const theme = useTheme();
  const nav = useNavigation<NavigationProp<RootStackParamList>>();

  const onMore = () => {
    if (!user) return;
    showSafetyMenu({
      userId: user.id,
      userName: user.nickname,
      nav,
      onBlocked: onClose,
    });
  };

  return (
    <Sheet open={open} onClose={onClose} maxHeight="85%">
      {user && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Avatar
              name={user.nickname}
              uri={user.avatarUrl}
              avatarIdx={user.avatarIdx}
              size={56}
              shape="circle"
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.colors.text }]}>
                {user.nickname}
                {user.age ? ` · ${user.age}` : ''}
              </Text>
              <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 2 }}>
                {user.distance ?? ''}
              </Text>
            </View>
            <IconButton onPress={onMore}>
              <MoreHorizontal size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
            <IconButton onPress={onClose}>
              <X size={18} color={theme.colors.text} strokeWidth={1.6} />
            </IconButton>
          </View>

          {user.prompts && user.prompts.length > 0 && (
            <Card surface2 flat style={{ padding: 14, marginTop: 8 }}>
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

          {user.bio && (
            <View style={{ marginTop: 18 }}>
              <Text style={[styles.section, { color: theme.colors.muted }]}>关于</Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: theme.colors.text2 }}>
                {user.bio}
              </Text>
            </View>
          )}

          <View style={{ marginTop: 18 }}>
            <Text style={[styles.section, { color: theme.colors.muted }]}>
              兴趣 · {user.sharedTags.length} 个共同
            </Text>
            <View style={styles.tagsRow}>
              {(user.interests as InterestTagId[]).map((id) => {
                const tag = tagById(id);
                if (!tag) return null;
                return (
                  <TagChip
                    key={id}
                    tag={tag}
                    shared={user.sharedTags.includes(id)}
                  />
                );
              })}
            </View>
          </View>

          <Button
            label={`想认识 ${user.nickname}`}
            onPress={onLike}
            leadingIcon={<Heart size={18} color="#FFFFFF" fill="#FFFFFF" />}
            fullWidth
            style={{ marginTop: 22, marginBottom: 8 }}
          />
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  name: { fontSize: 18, fontWeight: '700' },
  section: {
    fontSize: 12,
    letterSpacing: 0.72,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
