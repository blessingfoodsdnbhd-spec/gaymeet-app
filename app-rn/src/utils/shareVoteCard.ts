import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';

/**
 * Capture an off-screen VoteShareCard ref to a 1080×1080 PNG and open the
 * native share sheet. Prefers expo-sharing (reliable file share on both iOS
 * and Android); falls back to RN Share where it's unavailable.
 */
export async function shareVoteCard(ref: React.RefObject<any>, t: TFunction) {
  if (!ref.current) return;
  try {
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1080,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('votes.share.label'),
        UTI: 'public.png',
      });
    } else {
      await Share.share({ url: uri });
    }
  } catch {
    // User cancelled or capture/share failed — nothing to do.
  }
}
