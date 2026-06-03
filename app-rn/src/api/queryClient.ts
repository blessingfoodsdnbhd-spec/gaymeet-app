import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide React Query client.
 *
 * Defined in its own module (not inline in App.tsx) so the auth store can clear
 * it on sign-in / sign-out. It is an in-memory, process-lifetime singleton — so
 * without an explicit `clear()` on auth transitions, one user's cached data
 * (own profile via ['user','me-self'], ['me','stats'], ['moments'],
 * ['chats','list'], ['discover',…] — all keyed without a userId) survives a
 * logout and renders for the NEXT user who signs in during the same app
 * session. That cross-account leak is exactly what `clearSessionCaches()` in
 * store/auth.ts prevents by calling `queryClient.clear()` on both sign-out and
 * sign-in.
 */
export const queryClient = new QueryClient();
