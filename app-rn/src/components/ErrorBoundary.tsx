import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

/**
 * App-root error boundary.
 *
 * Catches render-time errors in the subtree so an unhandled throw shows a
 * friendly fallback + retry instead of white-screening the whole app. Async
 * errors (promises, event handlers) are NOT caught by React error boundaries —
 * those still need their own try/catch.
 *
 * Intentionally dependency-free (no theme, no i18n, no navigation): it renders
 * precisely when something upstream is broken, so it must not rely on context
 * that may itself be the thing that crashed. Copy is bilingual (繁中 / EN).
 */
interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Always log. Soft-forward to Sentry if it's installed/configured (HIGH-B);
    // kept as an optional require so this file has no hard Sentry dependency.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] render error:', error, info?.componentStack);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Sentry = require('@sentry/react-native');
      if (Sentry?.captureException) Sentry.captureException(error);
    } catch {
      // Sentry not installed / not configured — console log above suffices.
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>😵‍💫</Text>
        <Text style={styles.title}>出了点问题</Text>
        <Text style={styles.subtitle}>Something went wrong</Text>
        <Text style={styles.body}>
          请重试。如果问题持续出现，请重新启动应用。{'\n'}
          Please retry. If this keeps happening, restart the app.
        </Text>
        <Pressable
          onPress={this.handleReset}
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.buttonText}>重试 · Retry</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FAFAFC',
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1E', marginBottom: 4 },
  subtitle: { fontSize: 15, fontWeight: '600', color: '#6B6B72', marginBottom: 16 },
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: '#8A8A90',
    textAlign: 'center',
    marginBottom: 28,
  },
  button: {
    backgroundColor: '#6B4FE0',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 999,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
