import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Mic, Play, Square, RotateCcw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';

import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { useTheme } from '../../theme/ThemeProvider';

const MAX_MS = 60000; // 60s cap for a chat voice message
const MIN_MS = 1000;
const BARS = 28;

function meterToLevel(db: number | undefined): number {
  if (typeof db !== 'number') return 0.15;
  return Math.max(0.05, Math.min(1, (db + 60) / 60));
}

type Phase = 'idle' | 'recording' | 'recorded';

/**
 * Bottom-sheet recorder for a chat voice message (VOICE1). Modeled on the
 * profile VoiceRecorderSheet but, instead of uploading, it hands the recorded
 * file uri + duration back to the caller via onRecorded — ChatDetailScreen
 * then does the optimistic upload + send (mirroring the image flow).
 */
export function ChatVoiceRecorderSheet({
  open,
  onClose,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  onRecorded: (uri: string, durationMs: number) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const recRef = React.useRef<Audio.Recording | null>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [elapsed, setElapsed] = React.useState(0);
  const [levels, setLevels] = React.useState<number[]>(Array(BARS).fill(0.1));
  const [uri, setUri] = React.useState<string | null>(null);
  const [playing, setPlaying] = React.useState(false);

  const reset = React.useCallback(() => {
    setPhase('idle');
    setElapsed(0);
    setLevels(Array(BARS).fill(0.1));
    setUri(null);
    setPlaying(false);
  }, []);

  const cleanup = React.useCallback(async () => {
    try {
      if (recRef.current) { await recRef.current.stopAndUnloadAsync(); recRef.current = null; }
    } catch {}
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
    } catch {}
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!open) { cleanup(); reset(); }
    return () => { cleanup(); };
  }, [open, cleanup, reset]);

  const stopRecording = React.useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    try { await rec.stopAndUnloadAsync(); } catch {}
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    setUri(rec.getURI() ?? null);
    setPhase('recorded');
  }, []);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('profile.voiceIntro.micPermTitle'), t('profile.voiceIntro.micPermBody'));
        return;
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
        setElapsed(s.durationMillis || 0);
        setLevels((prev) => [...prev.slice(1), meterToLevel((s as any).metering)]);
        if ((s.durationMillis || 0) >= MAX_MS) stopRecording();
      });
      await rec.startAsync();
      recRef.current = rec;
      setPhase('recording');
      setElapsed(0);
    } catch (e: any) {
      Alert.alert(t('profile.voiceIntro.recordFailed'), e?.message ?? '');
      reset();
    }
  };

  const playPreview = async () => {
    if (!uri || playing) return;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          setPlaying(false);
        }
      });
    } catch {
      setPlaying(false);
    }
  };

  const onSend = () => {
    if (!uri || elapsed < MIN_MS) return;
    onRecorded(uri, Math.round(elapsed));
    onClose();
  };

  const secs = (elapsed / 1000).toFixed(1);
  const tooShort = elapsed < MIN_MS;

  return (
    <Sheet open={open} onClose={onClose} maxHeight="62%">
      <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: theme.colors.text }}>
          {t('chat.voice.title')}
        </Text>
        <Text style={{ fontSize: 13, color: theme.colors.muted, marginTop: 4 }}>
          {phase === 'recording'
            ? t('chat.voice.recording')
            : phase === 'recorded'
              ? `${secs}s`
              : t('chat.voice.tapToStart')}
        </Text>

        <View style={styles.wave}>
          {levels.map((lv, i) => (
            <View
              key={i}
              style={{
                width: 4,
                height: 6 + lv * 46,
                borderRadius: 2,
                backgroundColor: phase === 'idle' ? theme.colors.line : theme.colors.primary,
                opacity: phase === 'idle' ? 0.5 : 1,
              }}
            />
          ))}
        </View>

        {phase === 'idle' && (
          <Pressable onPress={startRecording} style={[styles.bigBtn, { backgroundColor: theme.colors.primary }]}>
            <Mic size={34} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        )}
        {phase === 'recording' && (
          <Pressable onPress={stopRecording} style={[styles.bigBtn, { backgroundColor: theme.colors.error }]}>
            <Square size={28} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
          </Pressable>
        )}
        {phase === 'recorded' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 18 }}>
            <Pressable onPress={playPreview} style={[styles.smBtn, { backgroundColor: theme.colors.primarySoft }]}>
              {playing ? <ActivityIndicator color={theme.colors.primaryDeep} /> : <Play size={24} color={theme.colors.primaryDeep} strokeWidth={2} fill={theme.colors.primaryDeep} />}
            </Pressable>
            <Pressable onPress={() => { cleanup(); reset(); }} style={[styles.smBtn, { backgroundColor: theme.colors.surface2 }]}>
              <RotateCcw size={22} color={theme.colors.text2} strokeWidth={2} />
            </Pressable>
          </View>
        )}

        {phase === 'recorded' && (
          <View style={{ width: '100%', marginTop: 22 }}>
            {tooShort && (
              <Text style={{ fontSize: 12.5, color: theme.colors.error, textAlign: 'center', marginBottom: 10 }}>
                {t('chat.voice.tooShort')}
              </Text>
            )}
            <Button label={t('chat.voice.send')} onPress={onSend} disabled={tooShort} fullWidth />
          </View>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 56, marginTop: 20, marginBottom: 8 },
  bigBtn: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  smBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
