import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { SettingsShell, SettingsCard, LinkRow, ToggleRow, Divider } from './SettingsShell';
import { getNotificationPrefs, updateNotificationPrefs } from '../../../api/notifications';

// UI groups → the backend notification types they cover. A group is ON when
// none of its types are in the `disabled` set.
const GROUPS: { key: string; types: string[] }[] = [
  { key: 'matches', types: ['match'] },
  { key: 'messages', types: ['message'] },
  { key: 'votes', types: ['vote_first_vote', 'vote_ending_24h', 'vote_ending_1h', 'vote_ended', 'vote_result'] },
  { key: 'follow', types: ['follow'] },
  { key: 'worldChatReply', types: ['world_chat_reply', 'world_chat_mention'] },
  { key: 'viewers', types: ['viewers_digest'] },
  { key: 'wants', types: ['wants_you_digest'] },
  { key: 'dailyMatches', types: ['daily_matches'] },
  { key: 'digest', types: ['daily_digest'] },
  { key: 'comeback', types: ['comeback'] },
];

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function NotificationSettings() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'granted' | 'denied' | 'undetermined' | 'unknown'>('unknown');

  const [disabled, setDisabled] = useState<string[]>([]);
  const [quietStart, setQuietStart] = useState<number | null>(null);
  const [quietEnd, setQuietEnd] = useState<number | null>(null);
  const quietOn = quietStart != null && quietEnd != null;

  const refresh = async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      setStatus(perm.granted ? 'granted' : perm.status === 'undetermined' ? 'undetermined' : 'denied');
    } catch {
      setStatus('unknown');
    }
  };

  useEffect(() => {
    refresh();
    getNotificationPrefs()
      .then((p) => {
        setDisabled(p.disabled ?? []);
        setQuietStart(p.quietStartHour ?? null);
        setQuietEnd(p.quietEndHour ?? null);
      })
      .catch(() => {});
  }, []);

  const save = (next: { disabled?: string[]; quietStartHour?: number | null; quietEndHour?: number | null }) => {
    updateNotificationPrefs(next).catch(() => {});
  };

  const groupOn = (types: string[]) => !types.some((tp) => disabled.includes(tp));

  const toggleGroup = (types: string[], on: boolean) => {
    const set = new Set(disabled);
    if (on) types.forEach((tp) => set.delete(tp));
    else types.forEach((tp) => set.add(tp));
    const next = [...set];
    setDisabled(next);
    save({ disabled: next });
  };

  const setQuiet = (on: boolean) => {
    if (on) {
      const s = 22;
      const e = 8;
      setQuietStart(s);
      setQuietEnd(e);
      save({ quietStartHour: s, quietEndHour: e });
    } else {
      setQuietStart(null);
      setQuietEnd(null);
      save({ quietStartHour: null, quietEndHour: null });
    }
  };

  const bumpStart = (d: number) => {
    const v = ((quietStart ?? 22) + d + 24) % 24;
    setQuietStart(v);
    save({ quietStartHour: v });
  };
  const bumpEnd = (d: number) => {
    const v = ((quietEnd ?? 8) + d + 24) % 24;
    setQuietEnd(v);
    save({ quietEndHour: v });
  };

  const label =
    status === 'granted'
      ? t('notificationSettings.statusGranted')
      : status === 'denied'
        ? t('notificationSettings.statusDenied')
        : status === 'undetermined'
          ? t('notificationSettings.statusUndetermined')
          : t('notificationSettings.statusUnknown');

  return (
    <SettingsShell title={t('notificationSettings.title')}>
      {/* System push status */}
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label={t('notificationSettings.systemPushLabel')} detail={label} />
        <Divider />
        <LinkRow label={t('notificationSettings.openSystemSettings')} onPress={() => Linking.openSettings()} />
      </SettingsCard>

      {/* Always-on (high priority) */}
      <Text style={[sectionStyle, { color: theme.colors.muted }]}>{t('notificationSettings.prefs.importantSection')}</Text>
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <ToggleRow
          label={t('notificationSettings.prefs.important')}
          hint={t('notificationSettings.prefs.importantHint')}
          value
          onValueChange={() => {}}
          disabled
        />
      </SettingsCard>

      {/* Toggleable groups */}
      <Text style={[sectionStyle, { color: theme.colors.muted }]}>{t('notificationSettings.prefs.moreSection')}</Text>
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        {GROUPS.map((g, i) => (
          <View key={g.key}>
            {i > 0 && <Divider />}
            <ToggleRow
              label={t(`notificationSettings.prefs.${g.key}`)}
              value={groupOn(g.types)}
              onValueChange={(v) => toggleGroup(g.types, v)}
            />
          </View>
        ))}
      </SettingsCard>

      {/* Quiet hours */}
      <Text style={[sectionStyle, { color: theme.colors.muted }]}>{t('notificationSettings.prefs.quietSection')}</Text>
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <ToggleRow
          label={t('notificationSettings.prefs.quietHours')}
          hint={t('notificationSettings.prefs.quietHoursHint')}
          value={quietOn}
          onValueChange={setQuiet}
        />
        {quietOn && (
          <>
            <Divider />
            <HourRow label={t('notificationSettings.prefs.from')} value={pad(quietStart!)} onMinus={() => bumpStart(-1)} onPlus={() => bumpStart(1)} />
            <Divider />
            <HourRow label={t('notificationSettings.prefs.to')} value={pad(quietEnd!)} onMinus={() => bumpEnd(-1)} onPlus={() => bumpEnd(1)} />
          </>
        )}
      </SettingsCard>
    </SettingsShell>
  );
}

function HourRow({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
      <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>{label}</Text>
      <Pressable onPress={onMinus} hitSlop={8} style={[stepBtn, { borderColor: theme.colors.line }]}>
        <Minus size={16} color={theme.colors.text} />
      </Pressable>
      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, width: 56, textAlign: 'center' }}>{value}</Text>
      <Pressable onPress={onPlus} hitSlop={8} style={[stepBtn, { borderColor: theme.colors.line }]}>
        <Plus size={16} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

const sectionStyle = {
  fontSize: 12,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  fontWeight: '700' as const,
  paddingHorizontal: 24,
  paddingTop: 18,
  paddingBottom: 8,
};

const stepBtn = {
  width: 30,
  height: 30,
  borderRadius: 15,
  borderWidth: 1,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
