import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { brandGradient } from '../../theme/tokens';
import type { Message } from '../../api/chats';

interface Props {
  msg: Message;
  from: 'me' | 'them';
  style?: any;
  /** Forwarded to the internal Pressable so the chat's long-press action sheet
   *  fires — without this the inner Pressable swallows the gesture. */
  onLongPress?: () => void;
}

const BUBBLE_WIDTH = 220;

/**
 * Location-message bubble. Renders as a small card:
 *   • brandGradient header strip with a MapPin glyph (no actual map —
 *     we'd need react-native-maps + an API key for that, deferred).
 *   • the reverse-geocode label (or a "lat, lng" fallback) below.
 * Tap → system maps via Linking: maps:// on iOS, geo: on Android, with
 * a https google maps fallback if neither scheme is registered.
 */
export function LocationBubble({ msg, from, style, onLongPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMe = from === 'me';
  const loc = msg.location;
  if (!loc) return null;

  const label =
    (typeof loc.label === 'string' && loc.label.trim()) ||
    `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;

  const open = async () => {
    const { lat, lng } = loc;
    const native =
      Platform.OS === 'ios'
        ? `maps://?q=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}`;
    const fallback = `https://www.google.com/maps/?q=${lat},${lng}`;
    try {
      const supported = await Linking.canOpenURL(native);
      await Linking.openURL(supported ? native : fallback);
    } catch {
      try {
        await Linking.openURL(fallback);
      } catch {
        Alert.alert(t('chat.location.openFailed'));
      }
    }
  };

  const isSending = msg.status === 'sending';
  const isFailed = msg.status === 'failed';

  return (
    <Pressable
      onPress={open}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={isSending}
      style={[
        styles.bubble,
        {
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          borderColor: theme.colors.line,
          backgroundColor: theme.colors.surface,
        },
        isFailed && { opacity: 0.5 },
        style,
      ]}
    >
      <LinearGradient
        colors={[...brandGradient.colors] as [string, string, ...string[]]}
        locations={[...brandGradient.locations] as [number, number, ...number[]]}
        start={brandGradient.start}
        end={brandGradient.end}
        style={styles.header}
      >
        <MapPin size={32} color="#FFFFFF" strokeWidth={2} fill="rgba(255,255,255,0.25)" />
      </LinearGradient>
      <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
        <Text
          numberOfLines={2}
          style={{
            color: theme.colors.text,
            fontSize: 13.5,
            fontWeight: '600',
            lineHeight: 19,
          }}
        >
          {label}
        </Text>
        <Text style={{ color: theme.colors.muted, fontSize: 11, marginTop: 4 }}>
          {t('chat.location.tapToOpen')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: BUBBLE_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
