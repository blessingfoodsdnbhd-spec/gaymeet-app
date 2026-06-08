import React from 'react';
import { Pressable } from 'react-native';
import { Volume2, Pause } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../theme/ThemeProvider';
import { takeVoice, ensureAudioMode } from '../utils/voiceCache';

// Module-level single-voice guard: only ONE voice may play app-wide at a time.
// Without this, opening a profile repeatedly (or multiple buttons auto-playing —
// grid card + AboutUserSheet + CardStack) stacked overlapping audio. Starting a
// new playback stops whatever instance was playing.
let activeVoiceStop: (() => void) | null = null;

/**
 * Tap-to-play a voice-intro URL. Toggles play/stop, auto-unloads on finish and
 * on unmount. `autoPlay` plays once on mount (used by Nearby auto-play).
 */
export function VoicePlayButton({
  url,
  size = 18,
  color,
  autoPlay = false,
  onPlayingChange,
}: {
  url: string;
  size?: number;
  color?: string;
  autoPlay?: boolean;
  onPlayingChange?: (playing: boolean) => void;
}) {
  const theme = useTheme();
  const soundRef = React.useRef<Audio.Sound | null>(null);
  // Guards a second play() from racing in while the first is still loading
  // (rapid double-tap / re-entry) — that's what produced stacked playback.
  const loadingRef = React.useRef(false);
  const [playing, setPlaying] = React.useState(false);
  const c = color ?? theme.colors.primary;

  const set = (v: boolean) => {
    setPlaying(v);
    onPlayingChange?.(v);
  };

  const stop = React.useCallback(async () => {
    if (activeVoiceStop === stop) activeVoiceStop = null;
    try { await soundRef.current?.unloadAsync(); } catch {}
    soundRef.current = null;
    set(false);
  }, []);

  const play = React.useCallback(async () => {
    if (!url) return;
    if (soundRef.current) { stop(); return; }     // already playing → toggle off
    if (loadingRef.current) return;               // a load is already in flight
    // Single-voice guard: stop whatever other instance is currently playing.
    if (activeVoiceStop && activeVoiceStop !== stop) activeVoiceStop();
    activeVoiceStop = stop;
    loadingRef.current = true;
    try {
      // Fast path: a preloaded sound (prefetched while the card was visible)
      // is already decoded — just replay it. Saves the 3–4s download+decode.
      const pre = takeVoice(url);
      let sound: Audio.Sound;
      if (pre) {
        sound = pre;
        soundRef.current = sound;
        set(true);
        sound.setOnPlaybackStatusUpdate((s) => {
          if (s.isLoaded && s.didJustFinish) stop();
        });
        await sound.replayAsync().catch(() => sound.playAsync());
        return;
      }
      // Slow path: not preloaded (e.g. opened from the grid). shouldPlay:true
      // starts on load — one bridge round-trip instead of load-then-play.
      await ensureAudioMode();
      const r = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      sound = r.sound;
      soundRef.current = sound;
      set(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) stop();
      });
    } catch {
      set(false);
    } finally {
      loadingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, stop]);

  // Auto-play once on mount when requested.
  React.useEffect(() => {
    if (autoPlay && url) play();
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pressable onPress={play} hitSlop={8}>
      {playing ? <Pause size={size} color={c} strokeWidth={2} fill={c} /> : <Volume2 size={size} color={c} strokeWidth={2} />}
    </Pressable>
  );
}
