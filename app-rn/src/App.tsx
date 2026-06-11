import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { ensureAudioMode } from './utils/voiceCache';
import { initSentry } from './lib/sentry';

initSentry();
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';

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
import { queryClient } from './api/queryClient';

/**
 * Warm the Render free-tier dyno during the splash window so the user's
 * first real action (auth, nearby fetch, etc.) doesn't hit a 30-50s cold
 * start. Pairs with the timeout+retry hardening in api/auth.ts — together
 * they make cold-start nearly invisible.
 *
 * Fire-and-forget: we never await it, swallow all errors, and abort the
 * fetch after 30s so a hung connection doesn't sit in the runtime forever.
 * Uses native fetch (not the api axios instance) to bypass auth headers,
 * interceptors, and the refresh-token machinery — this is a raw warm-up
 * ping, not an authenticated call.
 */
function wakeBackend() {
  const baseURL =
    (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
    'https://gaymeet-api.onrender.com';
  const controller = new AbortController();
  const cancel = setTimeout(() => controller.abort(), 30_000);
  fetch(`${baseURL.replace(/\/+$/, '')}/health`, { signal: controller.signal })
    .catch(() => {})
    .finally(() => clearTimeout(cancel));
}

// Deep links. meyou://invite/<code> (and the https mirror) → the redeem screen
// with the code pre-filled. Other schemes fall through to push-tap routing.
const LINKING = {
  prefixes: ['meyou://', 'https://meyou.uk', 'https://www.meyou.uk'],
  config: {
    screens: {
      RedeemInvite: 'invite/:code',
      // Room share links: the meyou.uk/r/{id} landing page bounces here via
      // meyou://room/{id} (and a future Universal Link maps the same path).
      WorldChatRoom: 'room/:roomId',
    },
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
      <SafeAreaProvider>
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
