-- ============================================================
-- GayMeet Database Schema v2.0 — Vertical Partitioning
-- PostgreSQL 16 + PostGIS 3.4
--
-- DESIGN RATIONALE:
--
-- The original monolithic `users` table is split into 4 tables
-- based on access pattern and write frequency:
--
--   users            — auth credentials only (write: login/register)
--   user_profiles    — display data (write: profile edit, rare)
--   user_locations   — GPS coordinates (write: every 30s while app open)
--   user_metrics     — counters & timestamps (write: every swipe/action)
--
-- WHY THIS MATTERS:
--
-- 1. LOCATION is the hottest column. A user with the app open
--    sends location updates every 30 seconds. On a monolithic
--    table with 100K users, that's 3,300 UPDATEs/sec all
--    competing for row-level locks against profile reads,
--    swipe counter increments, and auth token refreshes.
--    Isolating location into its own table means these writes
--    don't block or bloat the other tables.
--
-- 2. PostgreSQL MVCC creates a new tuple version on every
--    UPDATE. Frequent location writes on a fat row (with bio,
--    tags, avatar) generate massive WAL and dead-tuple bloat.
--    A skinny 3-column location table keeps vacuum fast.
--
-- 3. PROFILE data is read 50x for every 1 write. Keeping it
--    separate lets PostgreSQL cache it more effectively
--    (hot pages stay in shared_buffers longer).
--
-- 4. METRICS (swipe counts, last_active) are write-heavy
--    counters. Isolating them prevents counter-increment
--    row locks from blocking auth lookups.
--
-- JOIN COST: All 4 tables share the same PK (user_id UUID).
-- Joins are PK-to-PK index lookups → O(1) per row. The
-- nearby query joins location + profile, which is 2 index
-- lookups per result row — negligible compared to the
-- spatial scan cost.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";


-- ============================================================
-- 1. USERS  (auth-only, lightweight)
--
-- Write frequency: LOW (register, login, token refresh)
-- Read frequency:  MEDIUM (every authenticated request via JWT)
-- Row size:        ~200 bytes (small, stays in cache)
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Credentials
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20)  UNIQUE,
    password_hash   VARCHAR(255),

    -- OAuth
    provider        VARCHAR(20)  NOT NULL DEFAULT 'local'
                        CHECK (provider IN ('local', 'google', 'apple')),
    provider_id     VARCHAR(255),

    -- Session
    refresh_token   VARCHAR(500),

    -- Account state
    is_premium      BOOLEAN      NOT NULL DEFAULT false,
    is_verified     BOOLEAN      NOT NULL DEFAULT false,
    is_banned       BOOLEAN      NOT NULL DEFAULT false,
    is_shadow_banned BOOLEAN     NOT NULL DEFAULT false,  -- can use app but invisible to others
    device_id       VARCHAR(255),                          -- fraud prevention: detect re-registration

    -- Timestamps
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_login_method CHECK (
        email IS NOT NULL OR phone IS NOT NULL OR provider_id IS NOT NULL
    )
);

CREATE INDEX idx_users_email      ON users (email)   WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone      ON users (phone)   WHERE phone IS NOT NULL;
CREATE INDEX idx_users_provider   ON users (provider, provider_id)
                                  WHERE provider_id IS NOT NULL;
CREATE INDEX idx_users_not_banned ON users (id)       WHERE is_banned = false
                                                        AND is_shadow_banned = false;
CREATE INDEX idx_users_device     ON users (device_id) WHERE device_id IS NOT NULL;


-- ============================================================
-- 2. USER_PROFILES  (display data, read-heavy)
--
-- Write frequency: LOW (user edits profile, maybe once a week)
-- Read frequency:  VERY HIGH (shown on every card, nearby tile,
--                  match list, chat header — 50 reads per write)
-- Row size:        ~500-2000 bytes (bio + tags can be large)
--
-- Separated so that frequent location/metric UPDATEs don't
-- generate new MVCC tuple versions for this large row.
-- This table stays hot in shared_buffers because it's rarely
-- invalidated.
-- ============================================================
CREATE TABLE user_profiles (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    nickname    VARCHAR(50)  NOT NULL,
    avatar_url  VARCHAR(500),
    bio         TEXT,
    birthday    DATE,
    tags        TEXT[]       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Full-text search on nickname (for future "search users" feature)
CREATE INDEX idx_profiles_nickname ON user_profiles (nickname);


-- ============================================================
-- 3. USER_LOCATIONS  (GPS, high-frequency writes)
--
-- Write frequency: VERY HIGH (every 30s while app is open)
-- Read frequency:  HIGH (every nearby/discover query)
-- Row size:        ~80 bytes (tiny — fast vacuum, small WAL)
--
-- This is THE hottest table in the entire system. Isolation
-- means:
--   - 3,300 UPDATEs/sec (100K active users) don't lock
--     profile reads or auth lookups
--   - VACUUM runs in milliseconds on tiny rows
--   - WAL volume is 10-20x smaller than updating a fat
--     monolithic user row
--   - The GIST spatial index is the only index, and it
--     covers the only query pattern (ST_DWithin)
-- ============================================================
CREATE TABLE user_locations (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    location    GEOGRAPHY(Point, 4326),
    latitude    DOUBLE PRECISION  NOT NULL DEFAULT 0,
    longitude   DOUBLE PRECISION  NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- THE critical index: spatial lookup for nearby queries
CREATE INDEX idx_locations_geo ON user_locations USING GIST (location);

-- Recency: filter out stale locations (user hasn't opened app in 30 days)
CREATE INDEX idx_locations_freshness ON user_locations (updated_at DESC);


-- ============================================================
-- 4. USER_METRICS  (counters & activity, write-heavy)
--
-- Write frequency: HIGH (every swipe, every app open, every
--                  connect/disconnect, every action)
-- Read frequency:  MEDIUM (swipe limit checks, presence)
-- Row size:        ~60 bytes (tiny counters)
--
-- Counters are the second-hottest write pattern after location.
-- INCREMENT operations on a monolithic row would contend with
-- location updates. Separated here, they get their own row-lock
-- namespace.
-- ============================================================
CREATE TABLE user_metrics (
    user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    daily_swipes  INTEGER      NOT NULL DEFAULT 0,
    swipes_reset  DATE         NOT NULL DEFAULT CURRENT_DATE,
    is_online     BOOLEAN      NOT NULL DEFAULT false,
    last_active   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    total_swipes  BIGINT       NOT NULL DEFAULT 0,  -- lifetime counter
    total_matches BIGINT       NOT NULL DEFAULT 0,  -- lifetime counter
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metrics_online ON user_metrics (user_id) WHERE is_online = true;


-- ============================================================
-- 5. SWIPES
-- ============================================================
CREATE TABLE swipes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swiper_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swiped_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction   VARCHAR(4)   NOT NULL CHECK (direction IN ('like', 'pass')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_swipe_pair    UNIQUE (swiper_id, swiped_id),
    CONSTRAINT chk_no_self_swipe CHECK (swiper_id != swiped_id)
);

CREATE INDEX idx_swipes_reverse_like ON swipes (swiped_id, swiper_id)
                                     WHERE direction = 'like';
CREATE INDEX idx_swipes_by_swiper    ON swipes (swiper_id, swiped_id);


-- ============================================================
-- 6. MATCHES
-- ============================================================
CREATE TABLE matches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_match_pair   UNIQUE (user1_id, user2_id),
    CONSTRAINT chk_match_order CHECK  (user1_id < user2_id)
);

CREATE INDEX idx_matches_user1 ON matches (user1_id, created_at DESC);
CREATE INDEX idx_matches_user2 ON matches (user2_id, created_at DESC);


-- ============================================================
-- 7. MESSAGES
-- ============================================================
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID         NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id   UUID         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    content     TEXT         NOT NULL CHECK (LENGTH(content) > 0),
    is_read     BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_history   ON messages (match_id, created_at DESC);
CREATE INDEX idx_messages_unread    ON messages (match_id, sender_id)
                                    WHERE is_read = false;


-- ============================================================
-- 8. REPORTS
-- ============================================================
CREATE TABLE reports (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason        VARCHAR(50)  NOT NULL
                      CHECK (reason IN (
                          'harassment', 'spam', 'fake_profile',
                          'inappropriate_content', 'underage', 'other'
                      )),
    description   TEXT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_no_self_report CHECK (reporter_id != reported_id)
);

CREATE INDEX idx_reports_pending ON reports (created_at ASC) WHERE status = 'pending';
CREATE INDEX idx_reports_target  ON reports (reported_id, status);


-- ============================================================
-- 9. BLOCKS
-- ============================================================
CREATE TABLE blocks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_block_pair     UNIQUE (blocker_id, blocked_id),
    CONSTRAINT chk_no_self_block CHECK  (blocker_id != blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks (blocker_id, blocked_id);
CREATE INDEX idx_blocks_blocked ON blocks (blocked_id, blocker_id);


-- ============================================================
-- AUTO-UPDATE updated_at TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_profiles_updated
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_locations_updated
    BEFORE UPDATE ON user_locations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- HELPER: Initialize child rows on user creation
-- When a user registers, automatically create empty rows
-- in profiles, locations, and metrics so JOINs never fail.
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_init_user_children()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles     (user_id, nickname) VALUES (NEW.id, 'New User');
    INSERT INTO user_locations    (user_id) VALUES (NEW.id);
    INSERT INTO user_metrics      (user_id) VALUES (NEW.id);
    INSERT INTO user_preferences  (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_after_insert
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_init_user_children();


-- ============================================================
-- 10. SUBSCRIPTIONS  (monetization core)
--
-- Tracks active/expired premium subscriptions.
-- expires_at is indexed for cron job that flips is_premium.
-- ============================================================
CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan            VARCHAR(20)  NOT NULL CHECK (plan IN ('monthly', 'yearly')),
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'expired', 'cancelled', 'refunded')),
    platform        VARCHAR(10)  NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    platform_txn_id VARCHAR(255),              -- Apple/Google transaction ID
    starts_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ  NOT NULL,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subs_user     ON subscriptions (user_id, status);
CREATE INDEX idx_subs_expiring ON subscriptions (expires_at ASC) WHERE status = 'active';


-- ============================================================
-- 11. TRANSACTIONS  (payment audit trail)
--
-- Every money event: subscription purchase, renewal, boost buy.
-- Immutable append-only — never UPDATE or DELETE.
-- ============================================================
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(20)  NOT NULL
                        CHECK (type IN ('subscription', 'boost', 'refund')),
    amount_cents    INTEGER      NOT NULL,        -- store in cents, never float
    currency        VARCHAR(3)   NOT NULL DEFAULT 'USD',
    status          VARCHAR(20)  NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    platform        VARCHAR(10)  NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    platform_txn_id VARCHAR(255),
    metadata        JSONB,                        -- flexible extra data
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_txn_user ON transactions (user_id, created_at DESC);


-- ============================================================
-- 12. BOOSTS  (visibility upgrade — top revenue feature)
--
-- A boost puts the user at the top of nearby/discover for
-- a time window. The nearby query checks for active boosts
-- and sorts boosted users first.
--
-- Revenue potential: Grindr makes ~40% of IAP from boosts.
-- ============================================================
CREATE TABLE boosts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    starts_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ends_at     TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- "Is this user currently boosted?" — checked in every nearby query
-- Note: can't use WHERE ends_at > NOW() in partial index (NOW() is not immutable).
-- Filter active boosts in application queries instead.
CREATE INDEX idx_boosts_active ON boosts (user_id, ends_at DESC);


-- ============================================================
-- 13. USER_PREFERENCES  (matching intelligence)
--
-- Controls what users see in discover/nearby. Enables smart
-- ranking: score = distance_w + active_w + preference_match + boost_w
-- ============================================================
CREATE TABLE user_preferences (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    age_min             INTEGER      NOT NULL DEFAULT 18,
    age_max             INTEGER      NOT NULL DEFAULT 99,
    distance_max_km     INTEGER      NOT NULL DEFAULT 50,
    tags_preference     TEXT[]       NOT NULL DEFAULT '{}',    -- preferred tags
    show_online_only    BOOLEAN      NOT NULL DEFAULT false,
    hide_distance       BOOLEAN      NOT NULL DEFAULT false,   -- premium: others can't see your distance
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_age_range CHECK (age_min >= 18 AND age_max >= age_min)
);


-- ============================================================
-- RANKING QUERY: Nearby users with smart ordering
--
-- This replaces the simple distance-only sort with a
-- multi-factor ranking that makes the app feel alive:
--
-- ORDER BY:
--   1. Boosted users FIRST (paid visibility)
--   2. Recently active FIRST (app feels alive)
--   3. Closer users FIRST (relevance)
--
-- The CASE expression for boost is O(1) per row because
-- we LEFT JOIN on the boosts table with an index.
-- ============================================================
-- EXPLAIN ANALYZE
-- SELECT
--     u.id,
--     p.nickname,
--     p.avatar_url,
--     p.bio,
--     p.tags,
--     m.is_online,
--     m.last_active,
--     ST_Distance(
--         l.location,
--         ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
--     ) AS distance_m,
--     CASE WHEN b.id IS NOT NULL THEN true ELSE false END AS is_boosted
-- FROM user_locations l
-- JOIN users u            ON u.id = l.user_id
-- JOIN user_profiles p    ON p.user_id = l.user_id
-- JOIN user_metrics m     ON m.user_id = l.user_id
-- LEFT JOIN boosts b      ON b.user_id = l.user_id
--                         AND b.ends_at > NOW()
-- WHERE l.user_id != :current_user_id
--   AND u.is_banned = false
--   AND u.is_shadow_banned = false
--   AND l.location IS NOT NULL
--   AND ST_DWithin(
--         l.location,
--         ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
--         :radius_meters
--       )
--   AND l.updated_at > NOW() - INTERVAL '30 days'
--   -- Block filter
--   AND l.user_id NOT IN (
--       SELECT blocked_id FROM blocks WHERE blocker_id = :current_user_id
--       UNION ALL
--       SELECT blocker_id FROM blocks WHERE blocked_id = :current_user_id
--   )
--   -- Already-swiped filter
--   AND l.user_id NOT IN (
--       SELECT swiped_id FROM swipes WHERE swiper_id = :current_user_id
--   )
-- ORDER BY
--   (CASE WHEN b.id IS NOT NULL THEN 0 ELSE 1 END) ASC,  -- boosted first
--   m.last_active DESC,                                     -- recently active
--   distance_m ASC                                          -- closer first
-- LIMIT 20 OFFSET :offset;
