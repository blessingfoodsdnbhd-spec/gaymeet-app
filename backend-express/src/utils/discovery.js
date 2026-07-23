// Discovery visibility filter for official accounts (Meyou 官方 / bots).
//
// Official accounts (User.isOfficial === true) must NEVER surface in any
// user-facing discovery or people-list query — the swipe deck, Nearby grid,
// radar search, popular lists, globe/map, "想认识/who-liked-you", "谁在看你/
// viewers", followers/following lists, home widgets, etc.
//
// They remain fully visible on CONTENT surfaces (WorldChat messages, vote
// events, announcements) and when a profile is opened directly by id (e.g.
// tapping a chat message's sender) — those paths intentionally do NOT apply
// this filter.
//
// Usage: spread into a User aggregation `$geoNear.query` / `$match` stage or a
// Model.find() filter:  { ...NOT_OFFICIAL, otherConditions }
// For populate()-based lists, include `isOfficial` in the projection and drop
// official docs post-populate with isNotOfficial().
const NOT_OFFICIAL = { isOfficial: { $ne: true } };

/** Predicate for Array.filter on populated/serialized user docs. */
const isNotOfficial = (u) => !!u && u.isOfficial !== true;

// ── Demo/seed/review account isolation (P0) ──────────────────────────────────
// Real users must NEVER see demo accounts; demo accounts (Apple reviewer) see
// ONLY other demo accounts. Given the request's authenticated user, returns the
// Mongo clause for the `isDemo` field. Assign into any User or Moment query
// visible to the requester:  query.isDemo = demoVisibility(req.user);
// Works for both User and Moment (Moment.isDemo is denormalized from author).
const demoVisibility = (viewer) =>
  viewer && viewer.isDemo === true ? true : { $ne: true };

/** Array.filter predicate mirroring demoVisibility for populated/serialized docs. */
const demoVisible = (viewer, doc) =>
  viewer && viewer.isDemo === true ? doc?.isDemo === true : doc?.isDemo !== true;

module.exports = { NOT_OFFICIAL, isNotOfficial, demoVisibility, demoVisible };
