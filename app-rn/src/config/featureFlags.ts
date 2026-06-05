/**
 * Build-time feature flags.
 *
 * These gate user-facing surfaces that are temporarily hidden to reduce the
 * app's Apple 4.3(b) "saturated category" footprint. The underlying code and
 * backend routes are left intact — flip a flag back to `true` to resurrect the
 * feature post-review with no other change.
 */

/** Topic tabs / Topic Personas (主题身份) across Discover + Profile. */
export const TOPICS_ENABLED = false;

/** Private Photos (私密照片) upload + request/unlock flow. Public photos are
 *  unaffected — they're normal social-app photos and stay visible. */
export const PRIVATE_PHOTOS_ENABLED = false;
