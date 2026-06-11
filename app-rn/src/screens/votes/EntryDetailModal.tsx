import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Alert } from 'react-native';
import { X, Heart, MoreHorizontal } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { PhotoViewer } from '../../components/PhotoViewer';
import { RankMedal } from '../../components/RankMedal';
import { NameWithBadge } from '../../components/NameWithBadge';
import type { VoteEntry } from '../../api/votes';

/**
 * Full-screen entry reveal. Avatar-first contest detail taps in here: the
 * artwork shown big with pinch-zoom + swipe between entries (reusing
 * PhotoViewer), with a footer that tracks the current entry — submitter, vote
 * button, caption, and a report/block menu.
 */
export function EntryDetailModal({
  open,
  entries,
  initialIndex,
  canVote,
  myEntryId,
  busyVoteId,
  onClose,
  onVote,
  onReport,
  onBlock,
  onOpenUser,
}: {
  open: boolean;
  entries: VoteEntry[];
  initialIndex: number;
  canVote: boolean;
  myEntryId: string | null;
  busyVoteId: string | null;
  onClose: () => void;
  onVote: (entry: VoteEntry) => void;
  onReport: (entry: VoteEntry) => void;
  onBlock: (entry: VoteEntry) => void;
  onOpenUser: (userId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [index, setIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  if (!open) return null;
  const entry = entries[index];
  if (!entry) return null;
  const mine = myEntryId === entry.id;
  const eliminated = entry.status === 'eliminated';
  const winnerRank = entry.status?.startsWith('winner') ? Number(entry.status.replace('winner', '')) : null;

  const onMenu = () =>
    Alert.alert(entry.submitter.displayName, undefined, [
      { text: t('votes.report'), style: 'destructive', onPress: () => onReport(entry) },
      { text: t('votes.blockUser'), style: 'destructive', onPress: () => onBlock(entry) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <PhotoViewer
          open={open}
          photos={entries.map((e) => e.photoUrl)}
          initialIndex={initialIndex}
          chrome={false}
          onClose={onClose}
          onIndexChange={setIndex}
        />

        {/* Header — close · submitter · menu */}
        <View style={styles.header} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconBtn}>
            <X size={22} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => onOpenUser(entry.submitter.id)}
            hitSlop={{ top: 10, bottom: 10 }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 }}
          >
            <Avatar name={entry.submitter.displayName} uri={entry.submitter.avatarUrl} size={28} />
            {winnerRank ? <RankMedal rank={winnerRank} size={16} /> : null}
            <NameWithBadge
              name={entry.submitter.displayName}
              official={entry.submitter.isOfficial}
              verified={entry.submitter.isVerified}
              premium={entry.submitter.isPremium}
              textStyle={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}
              numberOfLines={1}
              badgeSize={16}
            />
            {eliminated && (
              <View style={styles.elimBadge}>
                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>{t('votes.eliminated')}</Text>
              </View>
            )}
          </Pressable>
          {!mine ? (
            <Pressable onPress={onMenu} hitSlop={12} style={styles.iconBtn}>
              <MoreHorizontal size={22} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>

        {/* Footer — caption + big vote button */}
        <View style={styles.footer} pointerEvents="box-none">
          {!!entry.caption && (
            <Text style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 21, marginBottom: 14, textAlign: 'center' }} numberOfLines={3}>
              {entry.caption}
            </Text>
          )}
          <Pressable
            onPress={() => onVote(entry)}
            disabled={!canVote || mine || eliminated || busyVoteId === entry.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              alignSelf: 'center',
              paddingHorizontal: 28,
              paddingVertical: 13,
              borderRadius: 999,
              backgroundColor: entry.votedByMe ? theme.colors.primary : 'rgba(255,255,255,0.16)',
              borderWidth: 1,
              borderColor: entry.votedByMe ? theme.colors.primary : 'rgba(255,255,255,0.4)',
              opacity: !canVote || mine || eliminated ? 0.5 : 1,
            }}
          >
            <Heart size={20} color="#FFFFFF" fill={entry.votedByMe ? '#FFFFFF' : 'transparent'} strokeWidth={2} />
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{entry.voteCount}</Text>
          </Pressable>
          {entries.length > 1 && (
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
              {index + 1} / {entries.length}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  elimBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  footer: {
    position: 'absolute',
    bottom: 44,
    left: 24,
    right: 24,
  },
});
