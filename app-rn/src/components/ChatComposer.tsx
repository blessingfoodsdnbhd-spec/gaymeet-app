import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Camera, ChevronLeft, Lock, Mic, Plus, Send, Smile, X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { useVoiceRecorder, VOICE_MIN_MS } from '../hooks/useVoiceRecorder';
import { VoiceRecordingHUD, formatVoiceDuration } from './VoiceRecordingHUD';

export type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  onPickPhotoFromLibrary?: () => void; // + button   — hidden if undefined
  onTakePhoto?: () => void; // 📷 button  — hidden if undefined
  /** Tap-the-mic fallback (opens a sheet recorder). Hold-to-record is preferred
   *  and used whenever `onVoiceRecorded` is provided. */
  onStartVoiceRecord?: () => void;
  /** Primary WhatsApp-style hold-to-record output: the recorded clip + length.
   *  When provided, holding the 🎤 records inline; the mic only renders if this
   *  or `onStartVoiceRecord` is set. */
  onVoiceRecorded?: (uri: string, durationMs: number, waveform?: number[]) => void;
  onOpenStickers?: () => void; // 😊 button  — hidden if undefined
  placeholder?: string;
  disabled?: boolean; // disables photo/send actions + dims them
  maxLength?: number; // when set: slice input + show counter past 80%
  /** Optional reply/edit banner shown above the input pill. */
  replyTo?: { id: string; text: string; name?: string } | null;
  onCancelReply?: () => void;
};

const LOCK_THRESHOLD = 56; // slide up this far → lock (hands-free)
const CANCEL_THRESHOLD = 90; // slide left this far → cancel

type VoicePhase = 'idle' | 'recording' | 'locked';

/**
 * Shared WhatsApp-style chat composer used by every chat surface
 * (private ChatDetail, World Chat, …). Layout:
 *
 *   [+]  [── TextInput + 😊 ──]  [📷]  [🎤 | 📤]
 *
 * Hold the 🎤 to record (slide ← to cancel, slide ↑ onto 🔒 to lock for a
 * hands-free HUD with trash / pause / send); a quick tap falls back to the
 * sheet recorder. Parents own all state + handlers; any optional handler left
 * undefined hides its button. KeyboardAvoidingView / SafeArea stay in the parent.
 */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onPickPhotoFromLibrary,
  onTakePhoto,
  onStartVoiceRecord,
  onVoiceRecorded,
  onOpenStickers,
  placeholder,
  disabled,
  maxLength,
  replyTo,
  onCancelReply,
}: ChatComposerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const hasText = value.trim().length > 0;

  const handleChange = (text: string) => {
    onChangeText(maxLength != null ? text.slice(0, maxLength) : text);
  };

  // ── Hold-to-record voice state machine ─────────────────────────────────────
  const canHoldRecord = !!onVoiceRecorded;
  const [voicePhase, setVoicePhaseState] = React.useState<VoicePhase>('idle');
  const voicePhaseRef = React.useRef<VoicePhase>('idle');
  const cancelledRef = React.useRef(false);
  const setVoicePhase = React.useCallback((p: VoicePhase) => {
    voicePhaseRef.current = p;
    setVoicePhaseState(p);
  }, []);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pulse = useSharedValue(1);

  const finishAndSendRef = React.useRef<() => void>(() => {});
  const recorder = useVoiceRecorder(() => finishAndSendRef.current());

  const resetDrag = React.useCallback(() => {
    dragX.value = 0;
    dragY.value = 0;
  }, [dragX, dragY]);

  const beginHold = React.useCallback(() => {
    cancelledRef.current = false;
    resetDrag();
    setVoicePhase('recording');
    recorder.start().then((okStarted) => {
      if (!okStarted && voicePhaseRef.current === 'recording') setVoicePhase('idle');
    });
  }, [recorder, resetDrag, setVoicePhase]);

  const lockHold = React.useCallback(() => {
    if (voicePhaseRef.current === 'recording') {
      setVoicePhase('locked');
      resetDrag();
    }
  }, [resetDrag, setVoicePhase]);

  const discardHold = React.useCallback(() => {
    if (voicePhaseRef.current === 'idle') return;
    cancelledRef.current = true;
    setVoicePhase('idle');
    resetDrag();
    recorder.cancel();
  }, [recorder, resetDrag, setVoicePhase]);

  const finishAndSend = React.useCallback(async () => {
    if (voicePhaseRef.current === 'idle') return;
    setVoicePhase('idle');
    resetDrag();
    const res = await recorder.stop();
    if (res && res.durationMs >= VOICE_MIN_MS) {
      onVoiceRecorded?.(res.uri, res.durationMs);
    }
  }, [recorder, onVoiceRecorded, resetDrag, setVoicePhase]);
  finishAndSendRef.current = finishAndSend;

  // Pan end (finger lifted) while not locked → cancel or send.
  const endHold = React.useCallback(() => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    if (voicePhaseRef.current !== 'recording') return; // locked → keep HUD
    finishAndSend();
  }, [finishAndSend]);

  // RNGH gives onEnd ONLY for a clean lift. If the Pan is CANCELLED/interrupted
  // (another gesture wins, the touch system reclaims, the screen blurs), onEnd
  // never fires — which left voicePhase stuck on 'recording' and the recording
  // overlay frozen on screen forever (the "giant mic won't go away / overlay
  // doesn't dismount" bug). onFinalize fires in BOTH cases, so we use it as the
  // safety net: on a non-successful finalize while still in the un-locked
  // recording phase, discard and reset. A 'locked' HUD is intentional hands-free
  // and is left alone (its gesture already ended successfully).
  const cancelStuckHold = React.useCallback(() => {
    if (voicePhaseRef.current === 'recording') {
      cancelledRef.current = true;
      setVoicePhase('idle');
      resetDrag();
      recorder.cancel();
    }
  }, [recorder, resetDrag, setVoicePhase]);

  // Stable trampolines so the gesture is built once but always calls latest.
  const handlersRef = React.useRef({ beginHold, lockHold, discardHold, endHold, cancelStuckHold });
  handlersRef.current = { beginHold, lockHold, discardHold, endHold, cancelStuckHold };
  const tapHandlerRef = React.useRef<(() => void) | undefined>(onStartVoiceRecord);
  tapHandlerRef.current = onStartVoiceRecord;

  const micGesture = React.useMemo(() => {
    const invokeBegin = () => handlersRef.current.beginHold();
    const invokeLock = () => handlersRef.current.lockHold();
    const invokeDiscard = () => handlersRef.current.discardHold();
    const invokeEnd = () => handlersRef.current.endHold();
    const invokeCancelStuck = () => handlersRef.current.cancelStuckHold();
    const invokeTap = () => tapHandlerRef.current?.();

    const pan = Gesture.Pan()
      .activateAfterLongPress(200)
      .onStart(() => {
        runOnJS(invokeBegin)();
      })
      .onUpdate((e) => {
        const x = Math.min(0, e.translationX);
        const y = Math.min(0, e.translationY);
        dragX.value = x;
        dragY.value = y;
        if (y < -LOCK_THRESHOLD) runOnJS(invokeLock)();
        else if (x < -CANCEL_THRESHOLD) runOnJS(invokeDiscard)();
      })
      .onEnd(() => {
        runOnJS(invokeEnd)();
      })
      .onFinalize((_e, success) => {
        if (!success) runOnJS(invokeCancelStuck)();
      });

    const tap = Gesture.Tap().onEnd(() => {
      runOnJS(invokeTap)();
    });

    return Gesture.Exclusive(pan, tap);
  }, [dragX, dragY]);

  // Pulse the recording mic.
  React.useEffect(() => {
    if (voicePhase === 'recording') {
      pulse.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
  }, [voicePhase, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(dragX.value, -120) }],
    opacity: 1 - Math.min(1, Math.abs(dragX.value) / 140),
  }));
  const lockStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.abs(Math.min(0, dragY.value)) / LOCK_THRESHOLD);
    return {
      transform: [{ translateY: Math.max(dragY.value, -70) }, { scale: 1 + p * 0.25 }],
    };
  });

  const recording = voicePhase === 'recording';
  const locked = voicePhase === 'locked';

  // Mic element: gesture-driven hold-to-record, or a plain tap button.
  const micButton = canHoldRecord ? (
    <GestureDetector gesture={micGesture}>
      <Animated.View
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Mic size={24} color={theme.colors.muted} strokeWidth={1.6} />
      </Animated.View>
    </GestureDetector>
  ) : onStartVoiceRecord ? (
    <Pressable
      onPress={onStartVoiceRecord}
      hitSlop={8}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Mic size={24} color={theme.colors.muted} strokeWidth={1.6} />
    </Pressable>
  ) : null;

  return (
    <View>
      {/* Reply / edit quote banner (hidden while recording) */}
      {replyTo && voicePhase === 'idle' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: theme.colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.line,
          }}
        >
          <View
            style={{
              width: 3,
              alignSelf: 'stretch',
              borderRadius: 2,
              backgroundColor: theme.colors.primary,
            }}
          />
          <View style={{ flex: 1 }}>
            {!!replyTo.name && (
              <Text
                style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}
                numberOfLines={1}
              >
                {replyTo.name}
              </Text>
            )}
            <Text style={{ fontSize: 12.5, color: theme.colors.muted }} numberOfLines={1}>
              {replyTo.text}
            </Text>
          </View>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <X size={18} color={theme.colors.muted} />
          </Pressable>
        </View>
      )}

      <View style={{ position: 'relative' }}>
        {/* Composer */}
        <View
          style={[
            styles.composer,
            { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.line },
          ]}
        >
          {/* + button → pick from photo library (routes through a confirm modal) */}
          {onPickPhotoFromLibrary && (
            <Pressable
              onPress={onPickPhotoFromLibrary}
              disabled={disabled}
              hitSlop={8}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={26} color={theme.colors.muted} strokeWidth={1.6} />
            </Pressable>
          )}

          {/* Rounded pill: TextInput + emoji on right edge (WhatsApp-style) */}
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.surface2,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: theme.colors.line,
              paddingLeft: 14,
              paddingRight: 6,
              minHeight: 40,
            }}
          >
            <TextInput
              value={value}
              onChangeText={handleChange}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.muted}
              multiline
              style={{
                flex: 1,
                paddingVertical: 8,
                fontSize: 15,
                color: theme.colors.text,
                maxHeight: 120,
              }}
            />
            {onOpenStickers && (
              <Pressable
                onPress={onOpenStickers}
                hitSlop={8}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
              >
                <Smile size={24} color={theme.colors.muted} strokeWidth={1.6} />
              </Pressable>
            )}
          </View>

          {/* Optional character counter (e.g. World Chat) */}
          {maxLength != null && value.length > maxLength * 0.8 && (
            <Text
              style={{
                fontSize: 11,
                color: theme.colors.muted,
                alignSelf: 'flex-end',
                marginBottom: 6,
              }}
            >
              {value.length}/{maxLength}
            </Text>
          )}

          {/* Right side: empty → camera + mic; typing → send arrow (WhatsApp swap) */}
          {hasText ? (
            <Pressable
              onPress={() => onSend(value)}
              disabled={disabled}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled ? 0.4 : 1,
              }}
            >
              <Send size={20} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          ) : (
            <>
              {onTakePhoto && (
                <Pressable
                  onPress={onTakePhoto}
                  disabled={disabled}
                  hitSlop={8}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Camera size={24} color={theme.colors.muted} strokeWidth={1.6} />
                </Pressable>
              )}
              {micButton}
            </>
          )}
        </View>

        {/* Recording overlay (hold, not yet locked): timer · slide-to-cancel · lock */}
        {recording && (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: theme.colors.bg }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Animated.View style={pulseStyle}>
                <Mic size={22} color={theme.colors.error} strokeWidth={2} />
              </Animated.View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
                {formatVoiceDuration(recorder.elapsed)}
              </Text>
            </View>

            <Animated.View
              style={[slideStyle, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}
            >
              <ChevronLeft size={16} color={theme.colors.muted} strokeWidth={2} />
              <Text style={{ fontSize: 13, color: theme.colors.muted }}>
                {t('chat.voice.slideToCancel')}
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                lockStyle,
                {
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme.colors.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Lock size={18} color={theme.colors.primary} strokeWidth={2} />
            </Animated.View>
          </Animated.View>
        )}

        {/* Locked HUD (hands-free): trash · waveform · timer · pause · send */}
        {locked && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }]}>
            <VoiceRecordingHUD
              elapsed={recorder.elapsed}
              levels={recorder.levels}
              paused={recorder.phase === 'paused'}
              onDelete={discardHold}
              onTogglePause={() =>
                recorder.phase === 'paused' ? recorder.resume() : recorder.pause()
              }
              onSend={finishAndSend}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  overlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
});
