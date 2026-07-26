import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

/**
 * Native "rate this app" prompt (SKStoreReviewController / Play In-App Review).
 *
 * Both platforms rate-limit this hard and neither tells you whether the dialog
 * was actually shown — iOS allows at most 3 per year per user and silently
 * no-ops beyond that. So the only way to spend the quota well is to ask once,
 * after a moment the user is likely to feel good about, and never again.
 *
 * Rules encoded here:
 *  - Ask at most once per install, ever (`reviewPromptShown`).
 *  - Only from a positive moment — see the three call sites.
 *  - Never block or delay the thing the user was actually doing: every entry
 *    point is fire-and-forget and swallows its own errors.
 *
 * There is deliberately no custom "do you like the app?" pre-prompt. Apple's
 * guidelines forbid gating the native dialog behind your own sentiment filter.
 */

const SHOWN_KEY = 'reviewPromptShown';

/** Per-trigger counters, e.g. `reviewPrompt.count.moments`. */
const counterKey = (name: string) => `reviewPrompt.count.${name}`;

/**
 * Ask for a review, unless we already have.
 * @param reason short tag stored alongside the flag, so we can tell from a
 *   device dump which trigger fired first.
 * @returns true if the request was actually issued.
 */
export async function maybeAskReview(reason: string): Promise<boolean> {
  try {
    if (await AsyncStorage.getItem(SHOWN_KEY)) return false;
    // hasAction() is false on a device with no store (simulator, sideloaded
    // Android, older iOS) — calling requestReview there throws.
    if (!(await StoreReview.hasAction())) return false;

    await StoreReview.requestReview();
    // Written only after the request resolves. If it throws we leave the flag
    // unset so a later positive moment can try again, rather than burning the
    // one shot on a call that never rendered.
    await AsyncStorage.setItem(SHOWN_KEY, reason);
    return true;
  } catch {
    return false;
  }
}

/**
 * Increment a named counter and ask for a review once it reaches `threshold`.
 * Used for the "5th moment" and "10th launch" triggers.
 *
 * The counter keeps incrementing past the threshold — cheap, and it means the
 * numbers stay meaningful if we ever want to re-tune the thresholds.
 */
export async function countAndMaybeAskReview(
  counter: string,
  threshold: number,
  reason: string,
): Promise<void> {
  try {
    // Cheap exit before touching the counter — once we've asked, none of the
    // triggers need to keep doing work on every launch/post.
    if (await AsyncStorage.getItem(SHOWN_KEY)) return;

    const raw = await AsyncStorage.getItem(counterKey(counter));
    const next = (parseInt(raw ?? '0', 10) || 0) + 1;
    await AsyncStorage.setItem(counterKey(counter), String(next));
    if (next < threshold) return;

    await maybeAskReview(reason);
  } catch {
    // A storage failure must never break posting a moment or opening the app.
  }
}
