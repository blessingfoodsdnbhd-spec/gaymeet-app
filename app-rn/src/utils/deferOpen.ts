import { InteractionManager } from 'react-native';

/**
 * Open a modal/sheet/overlay on the NEXT stable frame instead of synchronously
 * inside an onPress/gesture callback. On Android, presenting a Modal/sheet while
 * a touch is still being processed (or a nav transition / inset animation is
 * mid-flight) makes it jump/"fly" before settling. Deferring until interactions
 * finish + one rAF lets the current frame complete first.
 *
 *   onPress={() => deferOpen(() => setSheetOpen(true))}
 */
export function deferOpen(fn: () => void) {
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(fn);
  });
}
