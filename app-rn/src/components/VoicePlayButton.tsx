import React from 'react';
import { Pressable, ActivityIndicator } from 'react-native';
import { Volume2, Pause } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../theme/ThemeProvider';
import { takeVoice, ensureAudioMode, prefetchVoice } from '../utils/voiceCache';

// Module-level single-voice guard: only ONE voice may play app-wide at a time.
// Without this, opening a profile repeatedly (or multiple buttons auto-playing —
// grid card + AboutUserSheet + CardStack) stacked overlapping audio. Starting a
// new playback stops whatever instance was playing.
let activeVoiceStop: (() => void) | null = null;

/**
 * Tap-to-play a voice-intro URL. Toggles play/stop, auto-unloads on finish and
 * on unmount. `autoPlay` plays once on mount (used by Nearby auto-play).
 * `preload` warms the voiceCache (shouldPlay:false) on mount so the first tap is
 * instant instead of a 3–4s download+decode — used by chat voice messages, where
 * nothing else prefetches (the Nearby grid/deck call prefetchMany themselves).
 */
export function VoicePlayButton({
  url,
  size = 18,
  color,
  autoPlay = false,
  preload = false,
  onPlayingChange,
}: {
  url: string;
  size?: number;
  color?: string;
  autoPlay?: boolean;
  preload?: boolean;
  onPlayingChange?: (playing: boolean) => void;
}) {
  const theme = useTheme();
  const soundRef = React.useRef<Audio.Sound | null>(null);
  // Guards a second play() from racing in while the first is still loading
  // (rapid double-tap / re-entry) — that's what produced stacked playback.
  const loadingRef = React.useRef(false);
  const [playing, setPlaying] = React.useState(false);
  // Visible loading state so a cold (un-preloaded) tap shows a spinner instead
  // of looking unresponsive/broken while the file downloads.
  const [loading, setLoading] = React.useState(false);
  const c = color ?? theme.colors.primary;

  const set = (v: boolean) => {
    setPlaying(v);
    onPlayingChange?.(v);
  };

  // Fires if playback never actually starts — see `armWatchdog`.
  const watchdogRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearWatchdog = React.useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
  }, []);

  /**
   * Reset the UI *synchronously*, then unload in the background.
   *
   * `unloadAsync()` used to be awaited before flipping `playing` back to
   * false. When the native call hung (a Sound wedged mid-prepare on Android)
   * the button was stuck showing ⏸ forever and every further tap re-entered
   * the same hanging await — the "pause doesn't respond" half of the bug.
   * Nothing here needs the unload to have completed, so don't wait for it.
   */
  const stop = React.useCallback(() => {
    if (activeVoiceStop === stop) activeVoiceStop = null;
    clearWatchdog();
    const s = soundRef.current;
    soundRef.current = null;
    loadingRef.current = false;
    setLoading(false);
    set(false);
    if (s) {
      s.setOnPlaybackStatusUpdate(null);
      s.unloadAsync().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearWatchdog]);

  /**
   * Tear everything down if the sound hasn't reported `isPlaying` within
   * `ms`. Covers the case where a play/replay call neither resolves nor
   * rejects (Android ExoPlayer stalls on a re-used, never-played Sound):
   * previously that left the button pinned at ⏸ with no audio, forever.
   */
  const armWatchdog = React.useCallback((ms: number) => {
    clearWatchdog();
    watchdogRef.current = setTimeout(() => { stop(); }, ms);
  }, [clearWatchdog, stop]);

  /**
   * Drive `playing` from the *actual* playback status rather than optimistically
   * from the fact that we called play(). A status carrying an error, or a loaded
   * sound that has stopped without finishing, now resets the button instead of
   * leaving it stuck in the playing state.
   */
  const attachStatus = React.useCallback((sound: Audio.Sound) => {
    sound.setOnPlaybackStatusUpdate((s) => {
      if (!s.isLoaded) {
        if ((s as any).error) stop();
        return;
      }
      if (s.didJustFinish) { stop(); return; }
      if (s.isPlaying) { clearWatchdog(); set(true); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, clearWatchdog]);

  const play = React.useCallback(async () => {
    if (!url) return;
    if (soundRef.current) { stop(); return; }     // already playing → toggle off
    if (loadingRef.current) return;               // a load is already in flight
    // Single-voice guard: stop whatever other instance is currently playing.
    if (activeVoiceStop && activeVoiceStop !== stop) activeVoiceStop();
    activeVoiceStop = stop;
    loadingRef.current = true;
    try {
      // The session must be (re)asserted on BOTH paths. The fast path used to
      // skip it, so a voice intro played straight after a recording session
      // inherited the recorder's earpiece routing and was silent.
      await ensureAudioMode();
      // Fast path: a preloaded sound (prefetched while the card was visible)
      // is already decoded — just replay it. Saves the 3–4s download+decode.
      // Only trust it if it's *still* loaded; a Sound that was unloaded out
      // from under us replays into silence.
      const pre = takeVoice(url);
      let sound: Audio.Sound | null = null;
      if (pre) {
        // Race the probe: a Sound wedged in the native layer can leave
        // getStatusAsync() pending forever, which would strand the tap. If it
        // doesn't answer promptly, treat the preload as unusable and refetch.
        const st = await Promise.race([
          pre.getStatusAsync().catch(() => null),
          new Promise<null>((res) => setTimeout(() => res(null), 800)),
        ]);
        if (st?.isLoaded) {
          sound = pre;
          soundRef.current = sound;
          attachStatus(sound);
          armWatchdog(6000);
          // Preloaded Sounds were created without an explicit tick interval, so
          // they'd default to 500ms — too slow to flip the icon. Tighten it and
          // also trust the status returned by replay/play so the ⏸ is immediate.
          sound.setProgressUpdateIntervalAsync(50).catch(() => {});
          const st2 = await sound.replayAsync().catch(() => sound!.playAsync());
          if (st2?.isLoaded && st2.isPlaying) { clearWatchdog(); set(true); }
          return;
        }
        pre.unloadAsync().catch(() => {}); // stale — fall through and refetch
      }
      // Slow path: not preloaded (e.g. opened from the grid). shouldPlay:true
      // starts on load — one bridge round-trip instead of load-then-play. Show
      // a spinner while it downloads so the tap doesn't look dead.
      setLoading(true);
      const r = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, progressUpdateIntervalMillis: 50 },
      );
      sound = r.sound;
      soundRef.current = sound;
      attachStatus(sound);
      armWatchdog(6000);
      if (r.status?.isLoaded && r.status.isPlaying) { clearWatchdog(); set(true); }
    } catch {
      stop();
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, stop, attachStatus, armWatchdog, clearWatchdog]);

  // Auto-play once on mount when requested; otherwise warm the cache when
  // `preload` is set so the first tap replays an already-decoded Sound. The
  // FlatList only mounts bubbles near the viewport, so this preloads just the
  // visible voice messages rather than the whole chat history.
  React.useEffect(() => {
    if (autoPlay && url) play();
    else if (preload && url) prefetchVoice(url);
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pressable onPress={play} hitSlop={8}>
      {loading ? (
        <ActivityIndicator size="small" color={c} />
      ) : playing ? (
        <Pause size={size} color={c} strokeWidth={2} fill={c} />
      ) : (
        <Volume2 size={size} color={c} strokeWidth={2} />
      )}
    </Pressable>
  );
}
