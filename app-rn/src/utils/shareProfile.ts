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
    await Share.share({
      message: t('about.shareMessage', { name: name || '', url }),
      url, // iOS shows this as the link attachment; Android uses message only
    });
  } catch {
    // User cancelled or share failed — nothing to do.
  }
}
