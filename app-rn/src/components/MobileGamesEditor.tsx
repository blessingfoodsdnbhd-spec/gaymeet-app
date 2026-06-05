import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';

const MAX_GAMES = 10;
const MAX_LEN = 30;

/**
 * Chip input for the games a user plays — shown when the 'mobile-games'
 * interest is selected. Trim/dedupe (case-insensitive)/≤30 chars/≤10 total,
 * mirroring the server-side normalization in PATCH /users/me.
 */
export function MobileGamesEditor({
  games,
  onChange,
}: {
  games: string[];
  onChange: (next: string[]) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState('');

  const add = () => {
    const v = draft.trim().slice(0, MAX_LEN);
    if (!v) return;
    if (games.length >= MAX_GAMES) return;
    if (games.some((g) => g.toLowerCase() === v.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...games, v]);
    setDraft('');
  };

  const remove = (g: string) => onChange(games.filter((x) => x !== g));

  return (
    <View style={{ marginTop: 18 }}>
      <Text style={[styles.label, { color: theme.colors.muted }]}>
        🎮 {t('profile.mobileGames.label')}
      </Text>

      {games.length > 0 && (
        <View style={styles.chips}>
          {games.map((g) => (
            <View key={g} style={[styles.chip, { backgroundColor: theme.colors.primarySoft }]}>
              <Text style={{ fontSize: 13, color: theme.colors.primaryDeep, fontWeight: '600' }}>
                {g}
              </Text>
              <Pressable onPress={() => remove(g)} hitSlop={6}>
                <X size={14} color={theme.colors.primaryDeep} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {games.length < MAX_GAMES && (
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={(v) => setDraft(v.slice(0, MAX_LEN))}
            placeholder={t('profile.mobileGames.placeholder')}
            placeholderTextColor={theme.colors.muted}
            onSubmitEditing={add}
            returnKeyType="done"
            blurOnSubmit={false}
            style={[
              styles.input,
              { color: theme.colors.text, backgroundColor: theme.colors.surface2, borderColor: theme.colors.line },
            ]}
          />
          <Pressable
            onPress={add}
            disabled={!draft.trim()}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: theme.colors.primary, opacity: !draft.trim() ? 0.4 : pressed ? 0.85 : 1 },
            ]}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
              {t('profile.mobileGames.add')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 999,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
  },
});
