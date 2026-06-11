import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Shape = 'rounded' | 'angular';

interface Props {
  text: string;
  from: 'me' | 'them';
  shape?: Shape;
  tail?: boolean; // flatten one corner near the speaker
  style?: StyleProp<ViewStyle>;
}

export function Bubble({ text, from, shape = 'rounded', tail = true, style }: Props) {
  const theme = useTheme();
  const isMe = from === 'me';
  const big = shape === 'rounded' ? 20 : 8;
  const small = 6;

  const borderTopLeftRadius = big;
  const borderTopRightRadius = big;
  const borderBottomLeftRadius = isMe ? big : tail ? small : big;
  const borderBottomRightRadius = isMe ? (tail ? small : big) : big;

  return (
    <View
      style={[
        {
          backgroundColor: isMe ? theme.colors.bubbleMeBg : theme.colors.bubbleThemBg,
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 10,
          maxWidth: '78%',
          borderTopLeftRadius,
          borderTopRightRadius,
          borderBottomLeftRadius,
          borderBottomRightRadius,
          borderWidth: isMe ? 0 : 1,
          borderColor: theme.colors.line,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 15,
          lineHeight: 22,
          color: isMe ? theme.colors.bubbleMeText : theme.colors.bubbleThemText,
          // The bubble View hugs its content (maxWidth %, inside a zero-width
          // Pressable), so iOS floors the container width ~1px below the text's
          // natural glyph width and clips the trailing character ("Yes" → "Ye").
          // A hair of trailing room absorbs the sub-pixel rounding. The padding
          // is transparent so it's visually invisible.
          paddingRight: 2,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
