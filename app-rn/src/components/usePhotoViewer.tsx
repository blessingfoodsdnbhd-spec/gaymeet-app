import React from 'react';
import { Modal } from 'react-native';
import { PhotoViewer } from './PhotoViewer';

/**
 * Drop-in fullscreen photo viewer for any screen. Mount `node` once, then call
 * `open(photos, index)` from a Pressable. Uses a Modal so it works from plain
 * screens (the Sheet-based surfaces use PhotoViewer via the Sheet `overlay`
 * prop instead).
 */
export function usePhotoViewer() {
  const [state, setState] = React.useState<{ photos: string[]; index: number } | null>(null);

  const open = React.useCallback((photos: string[], index = 0) => {
    if (photos && photos.length) setState({ photos, index });
  }, []);
  const close = React.useCallback(() => setState(null), []);

  const node = (
    <Modal
      visible={!!state}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <PhotoViewer
        open={!!state}
        photos={state?.photos ?? []}
        initialIndex={state?.index ?? 0}
        onClose={close}
      />
    </Modal>
  );

  return { open, node };
}
