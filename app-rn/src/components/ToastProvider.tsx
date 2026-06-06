import React from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { setToastHandler } from '../utils/toastBridge';

type ToastKind = 'success' | 'error' | 'info';

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = React.createContext<ToastApi>({
  show: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
});

/** Global, non-blocking toast. `const toast = useToast(); toast.success('…')`. */
export const useToast = () => React.useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = React.useState<{ message: string; kind: ToastKind } | null>(null);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = React.useCallback(
    (message: string, kind: ToastKind = 'info') => {
      if (!message) return;
      setToast({ message, kind });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(({ finished }) => {
          if (finished) setToast(null);
        });
      }, 3000);
    },
    [opacity],
  );

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Expose the toast to non-React callers (e.g. the axios 401 interceptor).
  React.useEffect(() => {
    setToastHandler((message, kind) => show(message, kind));
    return () => setToastHandler(null);
  }, [show]);

  const api = React.useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
      info: (m) => show(m, 'info'),
    }),
    [show],
  );

  const bg =
    toast?.kind === 'success' ? theme.colors.online : toast?.kind === 'error' ? theme.colors.danger : theme.colors.text;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" style={[styles.wrap, { opacity, bottom: insets.bottom + 90 }]}>
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={styles.text} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 32 },
  toast: {
    maxWidth: 360,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
