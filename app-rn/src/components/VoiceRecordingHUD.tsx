import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Trash2, Pause, Play, Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';

export function formatVoiceDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Locked (hands-free) recording HUD, shown inline over the composer once the
 * user slides up onto the lock during a hold-to-record gesture (WhatsApp-style):
 *
 *   [🗑️]  [─ waveform ─]  m:ss  [⏸/▶]  [➤]
 *
 * Pure presentational — the parent (ChatComposer) owns the recorder + handlers.
 */
export function VoiceRecordingHUD({
  elapsed,
  levels,
  paused,
  onDelete,
  onTogglePause,
  onSend,
}: {
  elapsed: number;
  levels: number[];
  paused: boolean;
  onDelete: () => void;
  onTogglePause: () => void;
  onSend: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: theme.colors.bg,
      }}
    >
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        accessibilityLabel={t('chat.voice.tapToDelete')}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <Trash2 size={22} color={theme.colors.error} strokeWidth={2} />
      </Pressable>

      {/* Live waveform of the rolling level window. */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          height: 36,
          overflow: 'hidden',
        }}
      >
        {levels.map((lv, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4 + lv * 30,
              borderRadius: 2,
              backgroundColor: paused ? theme.colors.muted : theme.colors.primary,
            }}
          />
        ))}
      </View>

      <Text
        style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text2, minWidth: 38, textAlign: 'center' }}
      >
        {formatVoiceDuration(elapsed)}
      </Text>

      <Pressable
        onPress={onTogglePause}
        hitSlop={8}
        accessibilityLabel={paused ? t('chat.voice.recording') : t('chat.voice.locked')}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.error,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {paused ? (
          <Play size={20} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
        ) : (
          <Pause size={20} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
        )}
      </Pressable>

      <Pressable
        onPress={onSend}
        hitSlop={8}
        accessibilityLabel={t('chat.voice.send')}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Send size={20} color="#FFFFFF" strokeWidth={2} />
      </Pressable>
    </View>
  );
}
