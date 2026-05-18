import React from 'react';
import { View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface Props extends ViewProps {
  flat?: boolean; // no shadow
  surface2?: boolean; // off-white bg variant
  style?: StyleProp<ViewStyle>;
}

export function Card({ flat, surface2, style, children, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: surface2 ? theme.colors.surface2 : theme.colors.surface,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: theme.colors.line,
        },
        !flat && theme.shadows.soft,
        style,
      ]}
    >
      {children}
    </View>
  );
}
