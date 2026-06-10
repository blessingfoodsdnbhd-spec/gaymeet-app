import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Camera, Mic, Plus, Send, Smile, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

export type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  onPickPhotoFromLibrary?: () => void; // + button   — hidden if undefined
  onTakePhoto?: () => void; // 📷 button  — hidden if undefined
  onStartVoiceRecord?: () => void; // 🎤 button  — hidden if undefined
  onOpenStickers?: () => void; // 😊 button  — hidden if undefined
  placeholder?: string;
  disabled?: boolean; // disables photo/send actions + dims them
  maxLength?: number; // when set: slice input + show counter past 80%
  /** Optional reply/edit banner shown above the input pill. */
  replyTo?: { id: string; text: string; name?: string } | null;
  onCancelReply?: () => void;
};

/**
 * Shared WhatsApp-style chat composer used by every chat surface
 * (private ChatDetail, World Chat, …). Layout:
 *
 *   [+]  [── TextInput + 😊 ──]  [📷]  [🎤 | 📤]
 *
 * Parents own all state + handlers and pass them through; any optional
 * handler left undefined hides its button. The component owns ONLY the
 * composer bar + optional reply banner — KeyboardAvoidingView / SafeArea
 * stay in the parent.
 */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onPickPhotoFromLibrary,
  onTakePhoto,
  onStartVoiceRecord,
  onOpenStickers,
  placeholder,
  disabled,
  maxLength,
  replyTo,
  onCancelReply,
}: ChatComposerProps) {
  const theme = useTheme();
  const hasText = value.trim().length > 0;

  const handleChange = (text: string) => {
    onChangeText(maxLength != null ? text.slice(0, maxLength) : text);
  };

  return (
    <View>
      {/* Reply / edit quote banner (above the composer) */}
      {replyTo && (
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
      )}

      {/* Composer */}
      <View
        style={[
          styles.composer,
          { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line },
        ]}
      >
        {/* + button → pick from photo library (routes through a confirm modal) */}
        {onPickPhotoFromLibrary && (
          <Pressable
            onPress={onPickPhotoFromLibrary}
            disabled={disabled}
            hitSlop={8}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Plus size={26} color={theme.colors.muted} strokeWidth={1.6} />
          </Pressable>
        )}

        {/* Rounded pill: TextInput + emoji on right edge (WhatsApp-style) */}
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
          {onOpenStickers && (
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

        {/* Right side: empty → camera + mic; typing → send arrow (WhatsApp swap) */}
        {hasText ? (
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
            {onStartVoiceRecord && (
              <Pressable
                onPress={onStartVoiceRecord}
                hitSlop={8}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Mic size={24} color={theme.colors.muted} strokeWidth={1.6} />
              </Pressable>
            )}
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
