import React, { useState } from 'react';
import { View, TextInput, Pressable, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';

/**
 * Bordered input row used across the email/password auth screens — an optional
 * leading icon, the field, and (for password fields) a show/hide toggle. Mirrors
 * the input styling in EmailEntryScreen so the whole auth flow looks consistent.
 */
export function AuthField({
  icon,
  secure,
  style,
  ...props
}: TextInputProps & { icon?: React.ReactNode; secure?: boolean }) {
  const theme = useTheme();
  const [hidden, setHidden] = useState(true);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.m,
        borderWidth: 1,
        borderColor: theme.colors.line,
        paddingHorizontal: 16,
        marginTop: 12,
      }}
    >
      {icon}
      <TextInput
        placeholderTextColor={theme.colors.muted}
        secureTextEntry={secure ? hidden : false}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          { flex: 1, paddingVertical: 14, fontSize: 15, color: theme.colors.text },
          style,
        ]}
        {...props}
      />
      {secure && (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
          {hidden ? (
            <EyeOff size={18} color={theme.colors.muted} strokeWidth={1.6} />
          ) : (
            <Eye size={18} color={theme.colors.muted} strokeWidth={1.6} />
          )}
        </Pressable>
      )}
    </View>
  );
}
