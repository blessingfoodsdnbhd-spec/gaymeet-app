import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';

/** Capture an off-screen InviteShareCard ref to a 1080×1080 PNG and open the
 *  native share sheet (expo-sharing, RN Share fallback). */
export async function shareInviteCard(ref: React.RefObject<any>, t: TFunction) {
  if (!ref.current) return;
  try {
    const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1080 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('invite.title'), UTI: 'public.png' });
    } else {
      await Share.share({ url: uri });
    }
  } catch {
    // cancelled / failed — nothing to do
  }
}
