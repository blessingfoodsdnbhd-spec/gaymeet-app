import type { MomentPlace } from '../components/MomentLocationSheet';

/**
 * One-shot bridge for returning a map-picked place from MapPickerScreen back to
 * the Moment composer, WITHOUT routing a non-serializable callback through React
 * Navigation params (same stash pattern as utils/pushRouter). The composer
 * registers its setter before navigating; MapPicker resolves it on Save.
 */
let handler: ((p: MomentPlace) => void) | null = null;

export function setMomentLocationHandler(fn: ((p: MomentPlace) => void) | null) {
  handler = fn;
}

export function resolveMomentLocation(place: MomentPlace) {
  const h = handler;
  handler = null; // one-shot — clear before calling
  h?.(place);
}
