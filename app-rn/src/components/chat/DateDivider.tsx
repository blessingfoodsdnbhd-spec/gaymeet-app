import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { formatChatDate } from '../../utils/chatDate';

/** Centered day separator for chat message lists (WhatsApp/iMessage-style).
 *  Used by the private DM thread and the Plaza/World chat. */
export function DateDivider({ date }: { date: Date }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: theme.spacing.m }}>
      <Text
        style={{
          fontSize: theme.typography.size.bodySm,
          color: theme.colors.muted,
        }}
      >
        {formatChatDate(date)}
      </Text>
    </View>
  );
}
