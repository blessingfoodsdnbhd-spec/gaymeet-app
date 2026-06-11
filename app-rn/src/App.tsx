import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { ensureAudioMode } from './utils/voiceCache';
import { initSentry } from './lib/sentry';

initSentry();
import { NavigationContainer, getStateFromPath } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator } from 'react-native';

import './i18n';
import { ThemeProvider } from './theme/ThemeProvider';
import { colors } from './theme/tokens';
import { RootNavigator } from './navigation/RootNavigator';
import { navigationRef } from './navigation/navigationRef';
import { useAuth, getAccessToken } from './store/auth';
import { getMe } from './api/me';
import { loadFonts } from './theme/fonts';
import { GlobalMatchListener } from './components/GlobalMatchListener';
import { MessageBanner } from './components/MessageBanner';
import { SafetyMenuSheet } from './components/SafetyMenuSheet';
import { AnnouncementBootstrap } from './components/AnnouncementBootstrap';
import {
  registerPushToken,
  setupPushListeners,
  setupPushTokenRefresh,
} from './utils/push';
import { drainColdTap } from './utils/pushRouter';
import { slugToRoomId } from './utils/roomLink';
import { queryClient } from './api/queryClient';
import { wakeBackend } from './utils/warmup';

// Deep links. meyou://invite/<code> (and the https mirror) → the redeem screen
// with the code pre-filled. Other schemes fall through to push-tap routing.
const LINKING = {
  prefixes: ['meyou://', 'https://meyou.uk', 'https://www.meyou.uk'],
  config: {
    screens: {
      RedeemInvite: 'invite/:code',
      // Room share links. Two entry points land here:
      //  • the landing page bounce  meyou://room/<id>
      //  • Universal Link / App Link  https://meyou.uk/r/<slug>  (rewritten below)
      WorldChatRoom: 'room/:roomId',
    },
  },
  // The public share URL is /r/<slug> with a friendly slug (world-chitchat), but
  // the room screen wants the canonical colon id (country:world:chitchat). Rewrite
  // /r/<slug> → /room/<canonical> before the default parser runs, so a tapped
  // Universal Link / App Link opens the right room directly (no landing page).
  getStateFromPath(path: string, options?: Parameters<typeof getStateFromPath>[1]) {
    const m = path.match(/^\/?r\/([^/?#]+)/);
    if (m) {
      const roomId = slugToRoomId(decodeURIComponent(m[1]));
      path = `/room/${encodeURIComponent(roomId)}`;
    }
    return getStateFromPath(path, options);
  },
};

export function App() {
  const [bootDone, setBootDone] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const setUser = useAuth((s) => s.setUser);

  useEffect(() => {
    // Warm the backend before anything else so it's likely awake by the
    // time the user taps a button. Non-blocking — boot proceeds in
    // parallel and never waits on this.
    wakeBackend();

    // Wire push notification listeners + token-refresh subscriber once at
    // boot. Tap routing depends on navigationRef being ready — handlers
    // check isReady() themselves; cold-launch taps are stashed and drained
    // from NavigationContainer's onReady below.
    const teardownListeners = setupPushListeners();
    const teardownTokenRefresh = setupPushTokenRefresh();

    (async () => {
      // Load fonts and check auth in parallel
      const fontsPromise = loadFonts().catch(() => {
        // Fonts may not be in /assets/fonts yet — fall back to system silently
      });

      const token = await getAccessToken();
      if (token) {
        try {
          const me = await getMe();
          setUser(me);
          // Best-effort: register push token in the background. Silent on
          // permission denial, simulator, or any other failure.
          registerPushToken().catch(() => {});
        } catch {
          // Invalid token — let the user see Welcome
        }
      }

      // Warm the audio session so the first voice-intro play is fast.
      ensureAudioMode().catch(() => {});

      await fontsPromise;
      setFontsLoaded(true);
      setBootDone(true);
    })();

    return () => {
      teardownListeners();
      teardownTokenRefresh();
    };
  }, [setUser]);

  if (!bootDone || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* initialWindowMetrics seeds correct, synchronous safe-area insets on
          first render — required for native-stack modals (e.g. the moment map
          picker's fullScreenModal) to clear the status bar / Dynamic Island
          instead of reporting a 0 top inset. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
            <NavigationContainer
              ref={navigationRef}
              linking={LINKING}
              onReady={() => {
                // If the app was cold-launched by a push tap, replay the
                // routing intent now that the navigator is ready.
                drainColdTap();
              }}
            >
              <RootNavigator />
              {/* Both listeners use useNavigation() and must live inside
                  NavigationContainer to read the navigator context. */}
              <GlobalMatchListener />
              <MessageBanner />
              {/* Android-only safety menu sheet (iOS uses native ActionSheetIOS) */}
              <SafetyMenuSheet />
              {/* Post-login announcement modal — fetches /current iff
                  authed and renders the Modal on top of everything else
                  inside the container. Renders nothing when there's no
                  active announcement or it's been "don't show again". */}
              <AnnouncementBootstrap />
            </NavigationContainer>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
    </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
