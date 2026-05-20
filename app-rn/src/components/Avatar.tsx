import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { avatarGradients } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

type Shape = 'circle' | 'squircle' | 'square';

interface Props {
  name?: string;
  enName?: string;
  /** When present, renders the photo; the gradient + initial become a fallback. */
  uri?: string | null;
  avatarIdx?: number;
  size?: number;
  shape?: Shape;
  showOnline?: boolean;
}

export function Avatar({
  name,
  enName,
  uri,
  avatarIdx = 0,
  size = 48,
  shape = 'circle',
  showOnline,
}: Props) {
  const theme = useTheme();
  const [a, b] = avatarGradients[avatarIdx % avatarGradients.length];
  const initial = (enName || name || '?').trim().charAt(0).toUpperCase();
  const radius = shape === 'circle' ? size / 2 : shape === 'square' ? 8 : size * 0.32;
  const dotSize = Math.max(8, size * 0.22);

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <LinearGradient
          colors={[a, b]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontWeight: '600',
              fontSize: Math.round(size * 0.4),
              letterSpacing: 0.4,
            }}
          >
            {initial}
          </Text>
        </LinearGradient>
      )}
      {showOnline && (
        <View
          style={{
            position: 'absolute',
            right: 1,
            bottom: 1,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: theme.colors.online,
            borderWidth: 2,
            borderColor: theme.colors.surface,
          }}
        />
      )}
    </View>
  );
}
