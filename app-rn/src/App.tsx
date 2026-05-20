import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator } from 'react-native';

import './i18n';
import { ThemeProvider } from './theme/ThemeProvider';
import { colors } from './theme/tokens';
import { RootNavigator } from './navigation/RootNavigator';
import { useAuth, getAccessToken } from './store/auth';
import { getMe } from './api/me';
import { loadFonts } from './theme/fonts';
import { GlobalMatchListener } from './components/GlobalMatchListener';
import { MessageBanner } from './components/MessageBanner';
import { registerPushToken } from './utils/push';

const queryClient = new QueryClient();

export function App() {
  const [bootDone, setBootDone] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const setUser = useAuth((s) => s.setUser);

  useEffect(() => {
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

      await fontsPromise;
      setFontsLoaded(true);
      setBootDone(true);
    })();
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
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <NavigationContainer>
              <RootNavigator />
              {/* Both listeners use useNavigation() and must live inside
                  NavigationContainer to read the navigator context. */}
              <GlobalMatchListener />
              <MessageBanner />
            </NavigationContainer>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
