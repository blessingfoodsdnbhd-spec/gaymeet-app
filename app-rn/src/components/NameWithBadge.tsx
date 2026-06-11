import React from 'react';
import { View, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { PremiumBadge } from './PremiumBadge';

const OFFICIAL_BLUE = '#1D9BF0';
const PHOTO_VERIFIED_GREEN = '#3CC479'; // theme.colors.success

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
 * Green "real-person verified" seal (VERIFY1 — passed the selfie/video pose
 * check). Deliberately a different colour from the blue official badge so the
 * two signals read as distinct: official = staff, green = verified human.
 */
export function PhotoVerifiedBadge({ size = 15 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: PHOTO_VERIFIED_GREEN,
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
  verified,
  premium,
  textStyle,
  numberOfLines,
  badgeSize = 15,
  premiumSize,
  containerStyle,
}: {
  name: string;
  official?: boolean;
  /** Real-person (photo/video) verified → green seal. Shown when not official. */
  verified?: boolean;
  /** Active Premium member → Meyou "M" mark after the verified seal. */
  premium?: boolean;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  badgeSize?: number;
  /** Size for the Premium "M" mark. Defaults to badgeSize; pass a larger value
      to make the M optically match the seal (it has internal letterbox space). */
  premiumSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  if (!official && !verified && !premium) {
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
      {/* Official (blue) takes precedence; otherwise the green real-person seal. */}
      {official ? <VerifiedBadge size={badgeSize} /> : verified ? <PhotoVerifiedBadge size={badgeSize} /> : null}
      <PremiumBadge isPremium={premium} size={premiumSize ?? badgeSize} />
    </View>
  );
}
