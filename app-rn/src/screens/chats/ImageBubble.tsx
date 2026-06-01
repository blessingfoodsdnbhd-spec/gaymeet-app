import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { downloadAndCache, getCachedImage } from '../../utils/imageCache';
import type { Message } from '../../api/chats';

interface Props {
  msg: Message;
  from: 'me' | 'them';
  onPress: () => void;
  onLongPress?: () => void;
  style?: any;
}

const BUBBLE_WIDTH = 220;
const BUBBLE_HEIGHT = 280;

/**
 * Image-message bubble. Three states the renderer cares about:
 *
 *   expired         — server-side TTL passed or admin-cleaned; gray
 *                     box with Lock icon + "Photo expired" copy.
 *   sending         — optimistic local file:// URI; the original picker
 *                     output is used directly as the image source while
 *                     the upload is in flight; small ActivityIndicator
 *                     overlay.
 *   normal          — for received messages we prefer the on-disk cache
 *                     (instant + offline-tolerant) and fall back to the
 *                     server B2 URL. The download runs in the background
 *                     the first time the bubble mounts.
 */
export function ImageBubble({ msg, from, onPress, onLongPress, style }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMe = from === 'me';
  const [localUri, setLocalUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (msg.expired) return;
    // Optimistic-sending messages carry a local file:// URI in mediaUrl
    // already — no need to download or cache, the picker file IS the
    // source of truth until the server-side B2 URL replaces it.
    if (msg.status === 'sending') return;
    if (!msg.mediaUrl) return;

    (async () => {
      const cached = await getCachedImage(msg.id);
      if (cancelled) return;
      if (cached) {
        setLocalUri(cached);
        return;
      }
      const downloaded = await downloadAndCache(msg.id, msg.mediaUrl!);
      if (cancelled) return;
      if (downloaded) setLocalUri(downloaded);
    })();

    return () => {
      cancelled = true;
    };
  }, [msg.id, msg.mediaUrl, msg.expired, msg.status]);

  // Expired branch — flat gray block with Lock icon. No upstream URL
  // tried; the server-side handler has already zeroed mediaUrl on this
  // codepath.
  if (msg.expired) {
    return (
      <View
        style={[
          styles.bubble,
          {
            alignSelf: isMe ? 'flex-end' : 'flex-start',
            backgroundColor: theme.colors.surface2,
            borderColor: theme.colors.line,
            borderWidth: StyleSheet.hairlineWidth,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <Lock size={28} color={theme.colors.muted} strokeWidth={1.6} />
        <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 8 }}>
          {t('chat.image.expired')}
        </Text>
      </View>
    );
  }

  const displayUri = localUri ?? msg.mediaUrl ?? null;
  const isSending = msg.status === 'sending';
  const isFailed = msg.status === 'failed';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={isSending}
      style={[
        styles.bubble,
        { alignSelf: isMe ? 'flex-end' : 'flex-start' },
        isFailed && { opacity: 0.5 },
        style,
      ]}
    >
      {displayUri ? (
        <ExpoImage
          source={{ uri: displayUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.surface2 },
          ]}
        />
      )}
      {isSending && (
        <View style={styles.sendingOverlay}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
      {isFailed && (
        <View style={styles.failedOverlay}>
          <Text style={styles.failedText}>{t('chat.image.failed')}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: BUBBLE_WIDTH,
    height: BUBBLE_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  failedText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
