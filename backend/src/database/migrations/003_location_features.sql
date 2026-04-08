-- ============================================================
-- GayMeet Migration 003 — Location Features
--
-- Adds:
--   • height / weight / country_code to user_profiles
--   • shouts table (daily broadcast)
--   • virtual_location + stealth_mode to user_preferences
--   • popularity_tickets table
--   • popular_featured table (daily country top-10)
-- ============================================================

-- ============================================================
-- 1. USER_PROFILES — body stats + country
-- ============================================================

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS height       SMALLINT,        -- cm, nullable
    ADD COLUMN IF NOT EXISTS weight       SMALLINT,        -- kg, nullable
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);      -- ISO 3166-1 alpha-2, e.g. 'MY'

-- ============================================================
-- 2. USER_PREFERENCES — stealth + virtual location
-- ============================================================

ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS stealth_mode      BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS virtual_lat       DOUBLE PRECISION,   -- NULL = use real GPS
    ADD COLUMN IF NOT EXISTS virtual_lng       DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS virtual_location_label VARCHAR(200);  -- e.g. "Tokyo, Japan"

-- ============================================================
-- 3. SHOUTS — daily local broadcast
-- ============================================================

CREATE TABLE IF NOT EXISTS shouts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     VARCHAR(200) NOT NULL,

    -- Geographic position at time of shout
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,

    -- Shouts expire after 24 hours
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active shout per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_shouts_user_active
    ON shouts (user_id)
    WHERE expires_at > NOW();

-- Spatial-ish lookup (lat/lng box, full PostGIS query happens in app)
CREATE INDEX IF NOT EXISTS idx_shouts_location
    ON shouts (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_shouts_expires
    ON shouts (expires_at);

-- ============================================================
-- 4. POPULARITY_TICKETS — purchasable feature placement
-- ============================================================

CREATE TABLE IF NOT EXISTS popularity_tickets (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used_at     TIMESTAMPTZ,                        -- NULL = not yet used
    expires_at  TIMESTAMPTZ NOT NULL,               -- ticket is valid for 7 days after purchase
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_popularity_tickets_user
    ON popularity_tickets (user_id, used_at, expires_at);

-- ============================================================
-- 5. POPULAR_FEATURED — daily top-10 per country snapshot
-- ============================================================

CREATE TABLE IF NOT EXISTS popular_featured (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country_code    VARCHAR(2)  NOT NULL,
    feature_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
    rank            SMALLINT    NOT NULL,            -- 1-10
    source          VARCHAR(20) NOT NULL DEFAULT 'system'
                        CHECK (source IN ('system', 'ticket')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per user per country per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_featured_unique
    ON popular_featured (user_id, country_code, feature_date);

CREATE INDEX IF NOT EXISTS idx_popular_featured_date_country
    ON popular_featured (feature_date, country_code);

-- ============================================================
-- 6. Scheduled job comment (run via pg_cron or app cron)
-- ============================================================

-- Run daily at 00:00 UTC:
--
-- INSERT INTO popular_featured (user_id, country_code, rank, source)
-- SELECT
--     p.user_id,
--     p.country_code,
--     ROW_NUMBER() OVER (PARTITION BY p.country_code ORDER BY m.profile_views DESC, m.likes_received DESC) AS rank,
--     'system'
-- FROM user_profiles p
-- JOIN user_metrics  m ON m.user_id = p.user_id
-- JOIN users         u ON u.id      = p.user_id
-- WHERE u.is_banned = false
--   AND p.country_code IS NOT NULL
--   AND ROW_NUMBER() OVER (PARTITION BY p.country_code ORDER BY m.profile_views DESC) <= 10
-- ON CONFLICT (user_id, country_code, feature_date) DO NOTHING;
