import { Audio } from 'expo-av';

/**
 * Small LRU of pre-loaded voice-intro Sounds so auto-play in AboutUserSheet is
 * instant instead of a 3–4s download+decode. We preload (shouldPlay:false) the
 * intros of the top cards in the Nearby deck; when the sheet opens, the player
 * "takes" the ready Sound and replays it immediately.
 *
 * Ownership: a preloaded Sound stays in the cache until either evicted (then we
 * unload it) or taken by the player (then the player owns + unloads it).
 */

// Voice intros are tiny — caching more keeps far more taps instant. Bumped
// 5 → 20 so the whole visible Nearby grid (not just the deck's top cards)
// stays preloaded.
const MAX = 20;
// Insertion order = LRU order. Value null = "reserved / still loading".
const cache = new Map<string, Audio.Sound | null>();

let audioModeReady = false;
/**
 * Configure the audio session for PLAYBACK. Cheap-latched: normally a no-op
 * after the first call, but `invalidateAudioMode()` re-arms it so playback
 * re-asserts the session after anything that mutated it (recording).
 *
 * The Android keys matter as much as the iOS ones: recording puts the session
 * into a communication/earpiece routing mode, and a voice intro played after
 * that came out of the earpiece (i.e. inaudible unless the phone is held to
 * your ear) while the UI happily showed a "playing" state. Explicitly pinning
 * `playThroughEarpieceAndroid: false` forces the loudspeaker every time.
 */
export async function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  }).catch(() => {
    // Failed to apply — un-latch so the next play retries rather than
    // permanently running on whatever session the recorder left behind.
    audioModeReady = false;
  });
}

/**
 * Re-arm `ensureAudioMode()`. Call after any `Audio.Recording` session ends:
 * recording rewrites the shared audio session, and without this the latch
 * meant playback never restored loudspeaker routing for the rest of the
 * app's lifetime.
 */
export function invalidateAudioMode() {
  audioModeReady = false;
}

/** Hand the audio session back to playback after a recording session. */
export async function releasePlaybackAudio() {
  invalidateAudioMode();
  await ensureAudioMode();
}

function evict() {
  while (cache.size > MAX) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest == null) break;
    const s = cache.get(oldest);
    cache.delete(oldest);
    s?.unloadAsync?.().catch(() => {});
  }
}

/** Preload a voice intro (not playing). No-op if already cached/loading. */
export async function prefetchVoice(url?: string | null) {
  if (!url || cache.has(url)) return;
  cache.set(url, null); // reserve slot to dedupe concurrent loads
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: false });
    // If our reservation is gone (evicted/cleared mid-load), drop the sound.
    if (cache.get(url) === null) {
      cache.set(url, sound);
      evict();
    } else {
      sound.unloadAsync().catch(() => {});
    }
  } catch {
    if (cache.get(url) === null) cache.delete(url);
  }
}

/** Preload many intros (background, best-effort). Caps at MAX so we don't churn
 *  the cache; used to warm the whole visible Nearby grid / deck on mount. */
export function prefetchMany(urls: Array<string | null | undefined>) {
  const seen = new Set<string>();
  for (const u of urls) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    if (seen.size > MAX) break;
    prefetchVoice(u);
  }
}

/** Take ownership of a ready preloaded Sound, or null if not preloaded yet. */
export function takeVoice(url?: string | null): Audio.Sound | null {
  if (!url) return null;
  const s = cache.get(url);
  if (s) {
    cache.delete(url);
    return s;
  }
  return null; // null reservation (loading) or absent
}

/** Unload everything (call when the Nearby deck unmounts). */
export async function clearVoiceCache() {
  const sounds = [...cache.values()];
  cache.clear();
  for (const s of sounds) {
    try {
      await s?.unloadAsync?.();
    } catch {
      /* ignore */
    }
  }
}
