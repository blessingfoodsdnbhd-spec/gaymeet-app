import { Share } from 'react-native';
import type { TFunction } from 'i18next';

// Public profile link. The meyou.uk/u/:userId landing page is a follow-up
// (a minimal Cloudflare Pages page with name+avatar+"Get the app"); for now we
// just share the link.
const PROFILE_BASE = 'https://meyou.uk/u';

export function profileUrl(userId: string) {
  return `${PROFILE_BASE}/${userId}`;
}

/** Open the native share sheet for a user's profile link. */
export async function shareProfile(userId: string, name: string, t: TFunction) {
  if (!userId) return;
  const url = profileUrl(userId);
  try {
    // Link lives in `message` only. Passing `url` too makes iOS hand both the
    // body and the URL attachment to the share target (e.g. WhatsApp pastes
    // both), duplicating the link. Android ignores `url` anyway.
    await Share.share({
      message: t('about.shareMessage', { name: name || '', url }),
    });
  } catch {
    // User cancelled or share failed — nothing to do.
  }
}
