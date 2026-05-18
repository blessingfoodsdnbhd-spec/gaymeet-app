import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Mic, MicOff, Phone, Volume2 } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../../components/Avatar';
import { avatarGradients } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Rt = RouteProp<RootStackParamList, 'Call'>;

function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Visual implementation of the voice-call screen. Wires UI only — actual
 * RTC connection (LiveKit / Agora) is post-launch.
 */
export function CallScreen() {
  const theme = useTheme();
  const nav = useNavigation();
  const route = useRoute<Rt>();
  const { userId } = route.params;

  // Placeholder data — in a real call we'd fetch / pass the other user.
  const idx = idxFor(userId);
  const [a, b] = avatarGradients[idx % avatarGradients.length];
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <LinearGradient
        colors={[a, b, '#0F0F12']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ alignItems: 'center', paddingTop: 24 }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: 1 }}>
            语音通话
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRings />
          <View style={{ zIndex: 2 }}>
            <Avatar name="?" avatarIdx={idx} size={140} shape="circle" />
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '600', marginTop: 28 }}>
            通话中
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 16,
              marginTop: 8,
              fontVariant: ['tabular-nums'],
            }}
          >
            {mmss(duration)}
          </Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={() => setMuted((m) => !m)}
            style={[styles.controlBtn, muted && { backgroundColor: 'rgba(255,255,255,0.95)' }]}
          >
            {muted ? (
              <MicOff size={22} color="#1F1E29" strokeWidth={1.8} />
            ) : (
              <Mic size={22} color="#FFFFFF" strokeWidth={1.8} />
            )}
          </Pressable>
          <Pressable
            onPress={() => nav.goBack()}
            style={[styles.controlBtn, styles.hangup]}
          >
            <Phone
              size={26}
              color="#FFFFFF"
              strokeWidth={1.8}
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </Pressable>
          <Pressable
            onPress={() => setSpeakerOn((s) => !s)}
            style={[styles.controlBtn, speakerOn && { backgroundColor: 'rgba(255,255,255,0.95)' }]}
          >
            <Volume2
              size={22}
              color={speakerOn ? '#1F1E29' : '#FFFFFF'}
              strokeWidth={1.8}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function PulseRings() {
  return (
    <>
      <Ring delay={0} />
      <Ring delay={700} />
    </>
  );
}

function Ring({ delay }: { delay: number }) {
  const s = useSharedValue(0.85);
  const o = useSharedValue(0.6);

  useEffect(() => {
    s.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.6, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
    o.value = withDelay(
      delay,
      withRepeat(
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [delay, s, o]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: o.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: 160,
          height: 160,
          borderRadius: 80,
          borderWidth: 2,
          borderColor: '#FFFFFF',
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 22,
    paddingBottom: 36,
    paddingHorizontal: 28,
  },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangup: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E14B5C',
  },
});
