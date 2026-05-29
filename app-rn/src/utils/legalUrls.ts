/**
 * Single source of truth for the legal/help URLs the app links out to.
 *
 *   - Privacy: served from backend-express/public/privacy.html via the
 *     /privacy route mounted in app.js
 *   - Terms:   served from /terms (same pattern, used as the EULA URL in
 *     App Store Connect)
 *   - Support: served from /support (linked from the App Store listing)
 *
 * Apple guideline 3.1.2(c) requires the subscription screen to expose
 * functional links to BOTH Privacy and Terms; we also surface them on
 * the auth Welcome screen so the pre-login disclaimer line is
 * actionable.
 */
export const PRIVACY_URL = 'https://gaymeet-api.onrender.com/privacy';
export const TERMS_URL = 'https://gaymeet-api.onrender.com/terms';
export const SUPPORT_URL = 'https://gaymeet-api.onrender.com/support';

import { Linking } from 'react-native';

/**
 * Best-effort link-open. Apple rejects flows where these buttons no-op
 * silently in review (the reviewer taps them with no destination set),
 * so we swallow open errors but still attempt the URL — Linking.openURL
 * on an https:// scheme is supported on every iOS/Android version we
 * ship to, so a thrown promise here is exceptional.
 */
export async function openLegal(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // No-op: we intentionally don't surface an alert. The browser app
    // refusing an https URL is a device-level edge that the user can't
    // fix here anyway.
  }
}
