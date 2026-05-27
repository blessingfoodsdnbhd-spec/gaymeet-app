import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Navigation ref exposed at the module level so non-React code can navigate.
 *
 * Push-notification tap handlers fire outside React's component tree —
 * they may run before App.tsx mounts (cold tap) or in a stale render-frame
 * callback — so they can't `useNavigation()`. They call methods on this
 * ref instead.
 *
 * Always check `navigationRef.isReady()` before navigating; on cold tap
 * the ref is null until <NavigationContainer> mounts.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function safeNavigate<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
): boolean {
  if (!navigationRef.isReady()) return false;
  // @ts-expect-error — RN nav's overloaded signature; params is typed correctly on our side.
  navigationRef.navigate(name, params);
  return true;
}
