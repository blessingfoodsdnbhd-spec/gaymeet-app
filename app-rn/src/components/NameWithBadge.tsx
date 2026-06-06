import React from 'react';
import { View, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';

const OFFICIAL_BLUE = '#1D9BF0';

/** Blue verified seal (official Meyou accounts). */
export function VerifiedBadge({ size = 15 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: OFFICIAL_BLUE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Check size={Math.round(size * 0.66)} color="#FFFFFF" strokeWidth={3.5} />
    </View>
  );
}

/**
 * A display name with the verified badge appended when the user is an official
 * account. Centralized so every name render is impersonation-aware (and so a
 * future VIP/role badge slots in here once).
 */
export function NameWithBadge({
  name,
  official,
  textStyle,
  numberOfLines,
  badgeSize = 15,
  containerStyle,
}: {
  name: string;
  official?: boolean;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  badgeSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  if (!official) {
    return (
      <Text style={textStyle} numberOfLines={numberOfLines}>
        {name}
      </Text>
    );
  }
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }, containerStyle]}>
      <Text style={[textStyle, { flexShrink: 1 }]} numberOfLines={numberOfLines}>
        {name}
      </Text>
      <VerifiedBadge size={badgeSize} />
    </View>
  );
}
