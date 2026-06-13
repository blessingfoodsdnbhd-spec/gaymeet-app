import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Camera, Check, Mic, Pencil, Plus, Send, Smile, Trash2, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { useVoiceRecorder, VOICE_MIN_MS } from '../hooks/useVoiceRecorder';
import { formatVoiceDuration } from './VoiceRecordingHUD';
import { VoicePlayButton } from './VoicePlayButton';

export type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Send the text — OR, when `editing` is set, save the edit (the parent reads
   *  its own `editing` state to decide which). */
  onSend: (text: string) => void;
  onPickPhotoFromLibrary?: () => void; // + button   — hidden if undefined
  onTakePhoto?: () => void; // 📷 button  — hidden if undefined
  /** Tap-the-mic recording output: the recorded clip + length. The 🎤 only
   *  renders when this is provided. Tapping it starts recording immediately. */
  onVoiceRecorded?: (uri: string, durationMs: number, waveform?: number[]) => void;
  onOpenStickers?: () => void; // 😊 button  — hidden if undefined
  placeholder?: string;
  disabled?: boolean; // disables photo/send actions + dims them
  maxLength?: number; // when set: slice input + show counter past 80%
  /** Optional reply banner shown above the input pill. */
  replyTo?: { id: string; text: string; name?: string } | null;
  onCancelReply?: () => void;
  /** Inline-edit mode: when set, the composer shows an "Editing …" chip, the
   *  send button becomes a ✓ Save, and onSend saves the edit. */
  editing?: { id: string; preview: string } | null;
  onCancelEdit?: () => void;
};

/**
 * Shared chat composer used by every chat surface (private ChatDetail, World
 * Chat, …). Layout:
 *
 *   [+]  [── TextInput + 😊 ──]  [📷]  [🎤 | 📤]
 *
 * Voice: tapping the 🎤 starts recording immediately (no hold, no sheet) and
 * swaps the whole row for a recording bar — ✕ cancel · ● timer · ✓ send.
 * Inline-edit: when `editing` is set, an "Editing …" chip appears, the input is
 * pre-filled by the parent, and the send button becomes a ✓ Save. Parents own
 * all state + handlers; any optional handler left undefined hides its button.
 */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onPickPhotoFromLibrary,
  onTakePhoto,
  onVoiceRecorded,
  onOpenStickers,
  placeholder,
  disabled,
  maxLength,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
}: ChatComposerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const hasText = value.trim().length > 0;

  const handleChange = (text: string) => {
    onChangeText(maxLength != null ? text.slice(0, maxLength) : text);
  };

  // ── Tap-to-record voice ─────────────────────────────────────────────────────
  const canRecord = !!onVoiceRecorded;
  const recorder = useVoiceRecorder();
  // Optimistic flag so the bar appears the instant the mic is tapped, before the
  // async permission/prepare round-trip resolves.
  const [recording, setRecording] = React.useState(false);
  // Two-stage capture: after ✓ stops the recording we hold the clip here and show
  // a PREVIEW bar (play / re-record / send) instead of firing it off immediately.
  const [recorded, setRecorded] = React.useState<{ uri: string; durationMs: number } | null>(null);

  const startRec = React.useCallback(async () => {
    setRecording(true);
    const ok = await recorder.start();
    if (!ok) setRecording(false); // permission denied / setup failed
  }, [recorder]);

  const cancelRec = React.useCallback(async () => {
    setRecording(false);
    await recorder.cancel();
  }, [recorder]);

  // ✓ during recording → STOP (not send). Hand off to the preview bar; a clip
  // shorter than the floor is silently discarded back to the composer.
  const stopRec = React.useCallback(async () => {
    const res = await recorder.stop();
    if (res && res.durationMs >= VOICE_MIN_MS) setRecorded(res);
    setRecording(false);
  }, [recorder]);

  // 🗑 in the preview → drop the clip, back to the plain composer.
  const discardRecorded = React.useCallback(() => setRecorded(null), []);

  // 📤 in the preview → actually send the held clip.
  const sendRecorded = React.useCallback(() => {
    const r = recorded;
    setRecorded(null);
    if (r) onVoiceRecorded?.(r.uri, r.durationMs);
  }, [recorded, onVoiceRecorded]);

  // ── Recording bar (replaces the composer row while recording) ───────────────
  if (recording) {
    return (
      <View
        style={[
          styles.composer,
          { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line },
        ]}
      >
        {/* ✕ cancel + discard */}
        <Pressable
          onPress={cancelRec}
          hitSlop={8}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash2 size={24} color={theme.colors.error} strokeWidth={1.8} />
        </Pressable>

        {/* ● live timer */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 6,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: theme.colors.error,
            }}
          />
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
            {formatVoiceDuration(recorder.elapsed)}
          </Text>
        </View>

        {/* ✓ stop — ends the recording and opens the preview (does NOT send) */}
        <Pressable
          onPress={stopRec}
          accessibilityLabel={t('chat.voice.stop')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={22} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
      </View>
    );
  }

  // ── Preview bar (after ✓ stop): re-record · play · send ─────────────────────
  if (recorded) {
    return (
      <View
        style={[
          styles.composer,
          { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line },
        ]}
      >
        {/* 🗑 re-record / discard */}
        <Pressable
          onPress={discardRecorded}
          hitSlop={8}
          accessibilityLabel={t('chat.voice.tapToDelete')}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash2 size={24} color={theme.colors.error} strokeWidth={1.8} />
        </Pressable>

        {/* ▶︎ play preview + clip length, in a pill so it reads as a recorded clip */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            marginHorizontal: 2,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primarySoft,
          }}
        >
          <VoicePlayButton url={recorded.uri} size={22} color={theme.colors.primaryDeep} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.primaryDeep }}>
            {formatVoiceDuration(recorded.durationMs)}
          </Text>
        </View>

        {/* 📤 send the held clip */}
        <Pressable
          onPress={sendRecorded}
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

  // Mic element: tap to start recording.
  const micButton = canRecord ? (
    <Pressable
      onPress={startRec}
      disabled={disabled}
      hitSlop={8}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Mic size={24} color={theme.colors.muted} strokeWidth={1.6} />
    </Pressable>
  ) : null;

  // The banner above the pill: edit chip takes priority over the reply quote
  // (the parent clears one when it sets the other, so both are never set).
  const banner = editing ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: theme.colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.line,
      }}
    >
      <Pencil size={16} color={theme.colors.primary} strokeWidth={2} />
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}
          numberOfLines={1}
        >
          {t('chat.message.editTitle')}
        </Text>
        <Text style={{ fontSize: 12.5, color: theme.colors.muted }} numberOfLines={1}>
          {editing.preview}
        </Text>
      </View>
      <Pressable onPress={onCancelEdit} hitSlop={8}>
        <X size={18} color={theme.colors.muted} />
      </Pressable>
    </View>
  ) : replyTo ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: theme.colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.line,
      }}
    >
      <View
        style={{
          width: 3,
          alignSelf: 'stretch',
          borderRadius: 2,
          backgroundColor: theme.colors.primary,
        }}
      />
      <View style={{ flex: 1 }}>
        {!!replyTo.name && (
          <Text
            style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}
            numberOfLines={1}
          >
            {replyTo.name}
          </Text>
        )}
        <Text style={{ fontSize: 12.5, color: theme.colors.muted }} numberOfLines={1}>
          {replyTo.text}
        </Text>
      </View>
      <Pressable onPress={onCancelReply} hitSlop={8}>
        <X size={18} color={theme.colors.muted} />
      </Pressable>
    </View>
  ) : null;

  return (
    <View>
      {banner}

      {/* Composer */}
      <View
        style={[
          styles.composer,
          { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line },
        ]}
      >
        {/* + button → pick from photo library (routes through a confirm modal) */}
        {onPickPhotoFromLibrary && !editing && (
          <Pressable
            onPress={onPickPhotoFromLibrary}
            disabled={disabled}
            hitSlop={8}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Plus size={26} color={theme.colors.muted} strokeWidth={1.6} />
          </Pressable>
        )}

        {/* Rounded pill: TextInput + emoji on right edge */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.surface2,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: theme.colors.line,
            paddingLeft: 14,
            paddingRight: 6,
            minHeight: 40,
          }}
        >
          <TextInput
            value={value}
            onChangeText={handleChange}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.muted}
            multiline
            style={{
              flex: 1,
              paddingVertical: 8,
              fontSize: 15,
              color: theme.colors.text,
              maxHeight: 120,
            }}
          />
          {onOpenStickers && !editing && (
            <Pressable
              onPress={onOpenStickers}
              hitSlop={8}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Smile size={24} color={theme.colors.muted} strokeWidth={1.6} />
            </Pressable>
          )}
        </View>

        {/* Optional character counter (e.g. World Chat) */}
        {maxLength != null && value.length > maxLength * 0.8 && (
          <Text
            style={{
              fontSize: 11,
              color: theme.colors.muted,
              alignSelf: 'flex-end',
              marginBottom: 6,
            }}
          >
            {value.length}/{maxLength}
          </Text>
        )}

        {/* Right side. Editing → ✓ Save (always shown). Otherwise: empty →
            camera + mic; typing → send arrow. */}
        {editing ? (
          <Pressable
            onPress={() => onSend(value)}
            disabled={disabled || !hasText}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: disabled || !hasText ? 0.4 : 1,
            }}
          >
            <Check size={22} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        ) : hasText ? (
          <Pressable
            onPress={() => onSend(value)}
            disabled={disabled}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Send size={20} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        ) : (
          <>
            {onTakePhoto && (
              <Pressable
                onPress={onTakePhoto}
                disabled={disabled}
                hitSlop={8}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Camera size={24} color={theme.colors.muted} strokeWidth={1.6} />
              </Pressable>
            )}
            {micButton}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
