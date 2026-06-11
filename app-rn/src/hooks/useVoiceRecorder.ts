import React from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';

export const VOICE_MAX_MS = 60000; // 60s cap for a chat voice message
export const VOICE_MIN_MS = 1000;
const BARS = 28;

function meterToLevel(db: number | undefined): number {
  if (typeof db !== 'number') return 0.15;
  return Math.max(0.05, Math.min(1, (db + 60) / 60));
}

export type VoiceRecorderPhase = 'idle' | 'recording' | 'paused';

/**
 * expo-av recording engine shared by the WhatsApp-style hold-to-record composer
 * and (via ChatVoiceRecorderSheet) the tap fallback. Mirrors the recording
 * setup proven in ChatVoiceRecorderSheet (PR HH): HIGH_QUALITY + metering, 90ms
 * status ticks feeding a rolling level window for the live waveform.
 *
 * The imperative methods are safe to call from gesture `runOnJS` callbacks.
 */
export function useVoiceRecorder(onMaxReached?: () => void) {
  const { t } = useTranslation();
  const recRef = React.useRef<Audio.Recording | null>(null);
  const elapsedRef = React.useRef(0);
  const phaseRef = React.useRef<VoiceRecorderPhase>('idle');
  const maxCbRef = React.useRef(onMaxReached);
  maxCbRef.current = onMaxReached;

  const [elapsed, setElapsed] = React.useState(0);
  const [levels, setLevels] = React.useState<number[]>(Array(BARS).fill(0.1));
  const [phase, setPhaseState] = React.useState<VoiceRecorderPhase>('idle');

  const setPhase = React.useCallback((p: VoiceRecorderPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const resetMeters = React.useCallback(() => {
    elapsedRef.current = 0;
    setElapsed(0);
    setLevels(Array(BARS).fill(0.1));
  }, []);

  const releaseAudio = React.useCallback(async () => {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }, []);

  /** Begin recording. Returns false if permission denied / setup failed. */
  const start = React.useCallback(async (): Promise<boolean> => {
    if (recRef.current) return false;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('profile.voiceIntro.micPermTitle'), t('profile.voiceIntro.micPermBody'));
        return false;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      rec.setProgressUpdateInterval(90);
      rec.setOnRecordingStatusUpdate((s) => {
        if (!s.isRecording) return;
        elapsedRef.current = s.durationMillis || 0;
        setElapsed(s.durationMillis || 0);
        setLevels((prev) => [...prev.slice(1), meterToLevel((s as any).metering)]);
        if ((s.durationMillis || 0) >= VOICE_MAX_MS) maxCbRef.current?.();
      });
      await rec.startAsync();
      recRef.current = rec;
      resetMeters();
      setPhase('recording');
      return true;
    } catch (e: any) {
      Alert.alert(t('profile.voiceIntro.recordFailed'), e?.message ?? '');
      recRef.current = null;
      setPhase('idle');
      return false;
    }
  }, [t, resetMeters, setPhase]);

  /** Stop + unload, returning the file uri + clip length. */
  const stop = React.useCallback(async (): Promise<{ uri: string; durationMs: number } | null> => {
    const rec = recRef.current;
    recRef.current = null;
    setPhase('idle');
    if (!rec) return null;
    let uri: string | null = null;
    try {
      await rec.stopAndUnloadAsync();
      uri = rec.getURI();
    } catch {}
    await releaseAudio();
    const durationMs = Math.round(elapsedRef.current);
    return uri ? { uri, durationMs } : null;
  }, [releaseAudio, setPhase]);

  /** Discard the in-progress recording (no callback to the caller). */
  const cancel = React.useCallback(async () => {
    const rec = recRef.current;
    recRef.current = null;
    setPhase('idle');
    try {
      await rec?.stopAndUnloadAsync();
    } catch {}
    await releaseAudio();
    resetMeters();
  }, [releaseAudio, resetMeters, setPhase]);

  const pause = React.useCallback(async () => {
    try {
      await recRef.current?.pauseAsync();
      setPhase('paused');
    } catch {}
  }, [setPhase]);

  const resume = React.useCallback(async () => {
    try {
      await recRef.current?.startAsync();
      setPhase('recording');
    } catch {}
  }, [setPhase]);

  // Best-effort cleanup if the owner unmounts mid-recording.
  React.useEffect(() => {
    return () => {
      const rec = recRef.current;
      recRef.current = null;
      rec?.stopAndUnloadAsync().catch(() => {});
      releaseAudio();
    };
  }, [releaseAudio]);

  return { phase, phaseRef, elapsed, levels, start, stop, cancel, pause, resume };
}
