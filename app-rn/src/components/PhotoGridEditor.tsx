import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Plus, X } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeProvider';

/**
 * 5-slot photo grid editor. Each filled slot shows a thumbnail with an X
 * to remove; the first empty slot (up to `max`) shows a `+` to pick and
 * upload. Beyond `max` no more empty cells are rendered.
 *
 * Pass `badgeIcon` for slots that should carry a corner badge — e.g. a
 * Lock for the private gallery so the private slots are visually
 * distinct from the public ones when both grids appear on the same
 * screen (ProfileScreen).
 */
export function PhotoGridEditor({
  photos,
  max,
  busy,
  onAdd,
  onRemove,
  onView,
  onSetAvatar,
  onLongPress,
  avatarUrl,
  badgeIcon,
}: {
  photos: string[];
  max: number;
  busy: boolean;
  onAdd: () => void;
  onRemove: (url: string) => void;
  /** Tap the photo (not the X) to open it fullscreen. */
  onView?: (index: number) => void;
  /** Long-press a photo to set it as the avatar (gallery grids only). */
  onSetAvatar?: (url: string) => void;
  /** Long-press a photo for a custom action (takes precedence over
   *  onSetAvatar) — e.g. the private grid's "设为公开" menu. */
  onLongPress?: (url: string) => void;
  /** The current avatar URL — that slot gets a highlighted ring + badge. */
  avatarUrl?: string | null;
  badgeIcon?: React.ReactNode;
}) {
  const theme = useTheme();
  const slots: Array<{ kind: 'photo' | 'add' | 'empty'; url?: string }> = [];
  for (let i = 0; i < max; i++) {
    if (i < photos.length) slots.push({ kind: 'photo', url: photos[i] });
    else if (i === photos.length) slots.push({ kind: 'add' });
    else slots.push({ kind: 'empty' });
  }
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {slots.map((s, i) => {
        const common = {
          flex: 1,
          aspectRatio: 1,
          borderRadius: 10,
          overflow: 'hidden' as const,
          backgroundColor: theme.colors.surface2,
        };
        if (s.kind === 'photo' && s.url) {
          const isAvatar = !!avatarUrl && s.url === avatarUrl;
          return (
            <View
              key={`p-${s.url}`}
              style={[
                common,
                isAvatar && { borderWidth: 2, borderColor: theme.colors.primary },
              ]}
            >
              <Pressable
                onPress={() => onView?.(i)}
                onLongPress={
                  onLongPress
                    ? () => onLongPress(s.url!)
                    : onSetAvatar
                    ? () => onSetAvatar(s.url!)
                    : undefined
                }
                delayLongPress={300}
                disabled={!onView && !onSetAvatar && !onLongPress}
                style={StyleSheet.absoluteFill}
              >
                <ExpoImage
                  source={{ uri: s.url }}
                  style={StyleSheet.absoluteFill}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                />
              </Pressable>
              <Pressable
                onPress={() => onRemove(s.url!)}
                hitSlop={6}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={12} color="#FFFFFF" strokeWidth={2.4} />
              </Pressable>
              {badgeIcon && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {badgeIcon}
                </View>
              )}
            </View>
          );
        }
        if (s.kind === 'add') {
          return (
            <Pressable
              key={`add-${i}`}
              onPress={onAdd}
              disabled={busy}
              style={[
                common,
                {
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: theme.colors.line,
                  opacity: busy ? 0.5 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.colors.muted} />
              ) : (
                <Plus size={20} color={theme.colors.muted} strokeWidth={1.8} />
              )}
            </Pressable>
          );
        }
        return <View key={`e-${i}`} style={common} />;
      })}
    </View>
  );
}
