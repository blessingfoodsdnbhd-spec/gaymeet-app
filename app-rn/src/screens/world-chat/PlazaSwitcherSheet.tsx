import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Sheet } from '../../components/Sheet';

export interface SwitchRoom {
  id: string;
  flag: string;
  name: string;
  onlineCount: number;
  /** UGC rooms only: "by <creator>" subtitle. */
  by?: string;
}

interface Props {
  open: boolean;
  title: string;
  rooms: SwitchRoom[];
  activeId?: string | null;
  onSelect: (r: SwitchRoom) => void;
  onClose: () => void;
  /** When set, a "+ create topic room" CTA shows at the top (热门 sheet only). */
  onCreate?: () => void;
}

/**
 * Bottom-sheet room switcher for a Plaza section (热门 / 国家 / 兴趣). Lists rooms
 * with live online counts; tapping one switches the chat in-place and closes the
 * sheet. This is the ONLY way to switch rooms within a tab — no drawer. The 热门
 * sheet also offers a CTA to create a UGC topic room.
 */
export function PlazaSwitcherSheet({ open, title, rooms, activeId, onSelect, onClose, onCreate }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Sheet open={open} onClose={onClose} maxHeight="70%">
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>

      {onCreate && (
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [
            styles.createCta,
            { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Plus size={18} color={theme.colors.primaryDeep} strokeWidth={2.5} />
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: theme.colors.primaryDeep }}>
            {t('plaza.create.cta')}
          </Text>
        </Pressable>
      )}

      <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 12 }}>
        {rooms.map((r) => {
          const isActive = r.id === activeId;
          return (
            <Pressable
              key={r.id}
              onPress={() => onSelect(r)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: isActive ? theme.colors.primarySoft : 'transparent',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 22 }}>{r.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 15.5,
                    fontWeight: isActive ? '800' : '600',
                    color: isActive ? theme.colors.primaryDeep : theme.colors.text,
                  }}
                >
                  {r.name}
                </Text>
                {r.by && (
                  <Text numberOfLines={1} style={{ fontSize: 12, color: theme.colors.muted, marginTop: 1 }}>
                    {r.by}
                  </Text>
                )}
              </View>
              <View style={styles.countWrap}>
                <View style={[styles.dot, { backgroundColor: theme.colors.online }]} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.muted }}>{r.onlineCount}</Text>
              </View>
              {isActive && <Check size={18} color={theme.colors.primary} strokeWidth={2.5} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 12 },
  createCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
  },
  countWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
