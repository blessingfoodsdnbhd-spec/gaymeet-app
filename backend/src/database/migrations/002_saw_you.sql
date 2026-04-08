-- ============================================================
-- GayMeet Migration 002 — Saw You (License Plate Encounters)
--
-- Creates two new tables:
--   license_plates  — user-claimed plate numbers
--   plate_messages  — anonymous messages sent to a plate
--
-- Design notes:
--   • plate_number is the natural join key between tables
--     (denormalised intentionally so plate_messages can be
--     looked up without joining to license_plates first)
--   • user_id is nullable on license_plates: a message can be
--     sent to a plate before anyone claims it
--   • sender_id on plate_messages is NOT nullable: we always
--     know who sent the message (for abuse/blocking purposes),
--     even though the recipient cannot see the identity
-- ============================================================

-- ============================================================
-- 1. LICENSE_PLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS license_plates (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Nullable until a user claims this plate
    user_id         UUID         REFERENCES users(id) ON DELETE SET NULL,

    -- Normalised to uppercase, no spaces (enforced at app layer)
    plate_number    VARCHAR(20)  NOT NULL UNIQUE,

    is_verified     BOOLEAN      NOT NULL DEFAULT false,

    -- Optional photo of the car
    car_image_url   VARCHAR(500),

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast lookup by plate number (most common query)
CREATE INDEX IF NOT EXISTS idx_license_plates_plate_number
    ON license_plates (plate_number);

-- Look up all plates claimed by a user
CREATE INDEX IF NOT EXISTS idx_license_plates_user_id
    ON license_plates (user_id)
    WHERE user_id IS NOT NULL;

-- ============================================================
-- 2. PLATE_MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS plate_messages (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Denormalised — allows lookup without joining license_plates
    plate_number    VARCHAR(20)  NOT NULL,

    -- We always record who sent it (for moderation), never exposed to recipient
    sender_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    content         TEXT         NOT NULL,

    is_read         BOOLEAN      NOT NULL DEFAULT false,

    -- Moderation state
    is_reported     BOOLEAN      NOT NULL DEFAULT false,
    is_blocked      BOOLEAN      NOT NULL DEFAULT false,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Primary lookup: "all messages for plate X"
CREATE INDEX IF NOT EXISTS idx_plate_messages_plate_number
    ON plate_messages (plate_number);

-- Secondary lookup: "messages sent by user Y today" (daily limit check)
CREATE INDEX IF NOT EXISTS idx_plate_messages_sender_id_created
    ON plate_messages (sender_id, created_at DESC);

-- ============================================================
-- 3. UPDATED_AT trigger for license_plates
-- ============================================================

-- Reuse the update_updated_at_column function if it already exists,
-- otherwise create it.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_license_plates_updated_at
    BEFORE UPDATE ON license_plates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
