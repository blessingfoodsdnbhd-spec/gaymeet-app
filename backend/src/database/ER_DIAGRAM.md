# GayMeet v2.0 — Entity Relationship Diagram
## Vertical Partitioning + Monetization + Safety

## Visual Diagram (Mermaid)

```mermaid
erDiagram
    USERS ||--|| USER_PROFILES : "1:1"
    USERS ||--|| USER_LOCATIONS : "1:1"
    USERS ||--|| USER_METRICS : "1:1"
    USERS ||--|| USER_PREFERENCES : "1:1"
    USERS ||--o{ SWIPES : "swipes"
    USERS ||--o{ MATCHES : "matched"
    USERS ||--o{ MESSAGES : "sends"
    USERS ||--o{ REPORTS : "reports"
    USERS ||--o{ BLOCKS : "blocks"
    USERS ||--o{ SUBSCRIPTIONS : "subscribes"
    USERS ||--o{ TRANSACTIONS : "pays"
    USERS ||--o{ BOOSTS : "boosts"
    MATCHES ||--o{ MESSAGES : "contains"

    USERS {
        uuid id PK
        varchar email UK
        varchar phone UK
        varchar password_hash
        varchar provider
        varchar provider_id
        varchar refresh_token
        boolean is_premium
        boolean is_verified
        boolean is_banned
        boolean is_shadow_banned
        varchar device_id
        timestamptz created_at
        timestamptz updated_at
    }

    USER_PROFILES {
        uuid user_id PK_FK
        varchar nickname
        varchar avatar_url
        text bio
        date birthday
        text_arr tags
        timestamptz created_at
        timestamptz updated_at
    }

    USER_LOCATIONS {
        uuid user_id PK_FK
        geography location
        float latitude
        float longitude
        timestamptz updated_at
    }

    USER_METRICS {
        uuid user_id PK_FK
        int daily_swipes
        date swipes_reset
        boolean is_online
        timestamptz last_active
        bigint total_swipes
        bigint total_matches
        timestamptz created_at
    }

    USER_PREFERENCES {
        uuid user_id PK_FK
        int age_min
        int age_max
        int distance_max_km
        text_arr tags_preference
        boolean show_online_only
        boolean hide_distance
        timestamptz updated_at
    }

    SWIPES {
        uuid id PK
        uuid swiper_id FK
        uuid swiped_id FK
        varchar direction
        timestamptz created_at
    }

    MATCHES {
        uuid id PK
        uuid user1_id FK
        uuid user2_id FK
        timestamptz created_at
    }

    MESSAGES {
        uuid id PK
        uuid match_id FK
        uuid sender_id FK
        text content
        boolean is_read
        timestamptz created_at
    }

    REPORTS {
        uuid id PK
        uuid reporter_id FK
        uuid reported_id FK
        varchar reason
        text description
        varchar status
        timestamptz reviewed_at
        timestamptz created_at
    }

    BLOCKS {
        uuid id PK
        uuid blocker_id FK
        uuid blocked_id FK
        timestamptz created_at
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid user_id FK
        varchar plan
        varchar status
        varchar platform
        varchar platform_txn_id
        timestamptz starts_at
        timestamptz expires_at
        timestamptz cancelled_at
        timestamptz created_at
    }

    TRANSACTIONS {
        uuid id PK
        uuid user_id FK
        varchar type
        int amount_cents
        varchar currency
        varchar status
        varchar platform
        varchar platform_txn_id
        jsonb metadata
        timestamptz created_at
    }

    BOOSTS {
        uuid id PK
        uuid user_id FK
        timestamptz starts_at
        timestamptz ends_at
        timestamptz created_at
    }
```


## Architecture: 4-Table User Split

```
                     ┌─────────────────────┐
                     │      users           │  AUTH-ONLY (~200 bytes)
                     │ • credentials        │  Write: login/register
                     │ • OAuth provider     │  Read: every JWT validation
                     │ • is_premium/banned  │
                     │ • device_id          │
                     │ • is_shadow_banned   │
                     └─────────┬───────────┘
                               │ PK = user_id
          ┌────────────────────┼────────────────────┐
          │                    │                     │
┌─────────▼──────────┐ ┌──────▼─────────┐ ┌────────▼───────────┐
│  user_profiles     │ │ user_locations  │ │  user_metrics      │
│ (~500-2000 bytes)  │ │ (~80 bytes)     │ │  (~60 bytes)       │
│                    │ │                 │ │                    │
│ • nickname         │ │ • geography     │ │ • daily_swipes     │
│ • avatar_url       │ │ • lat/lng       │ │ • is_online        │
│ • bio              │ │ • updated_at    │ │ • last_active      │
│ • birthday         │ │                 │ │ • total_swipes     │
│ • tags             │ │ Write: 30s      │ │ • total_matches    │
│                    │ │ (VERY HIGH)     │ │                    │
│ Write: rare        │ │                 │ │ Write: every       │
│ Read: VERY HIGH    │ │ GIST spatial    │ │ action (HIGH)      │
│ (every card shown) │ │ index           │ │                    │
└────────────────────┘ └─────────────────┘ └────────────────────┘
          │
          │ Also:
          ▼
┌─────────────────────┐
│  user_preferences   │
│ • age_min/max       │
│ • distance_max_km   │
│ • tags_preference   │
│ • hide_distance     │
│                     │
│ Write: rare         │
│ Read: every query   │
└─────────────────────┘
```


## Monetization Tables

```
subscriptions ──────► transactions ◄────── boosts
(recurring $)         (audit trail)         (one-time $)
                      (append-only)

 User pays $9.99/mo    Every money event     User pays $4.99
 ┌──────────────┐      is recorded here      for 30min boost
 │ plan: monthly│      ┌──────────────┐      ┌──────────────┐
 │ status: active│     │ type: sub    │      │ starts_at    │
 │ expires_at   │      │ amount: 999  │      │ ends_at      │
 │ platform: ios│      │ currency: USD│      │ (+30 min)    │
 └──────────────┘      │ status: done │      └──────────────┘
                       └──────────────┘
                                            Boosted users sort
                                            FIRST in nearby query
```


## Ranking Query (the business logic)

```sql
ORDER BY
  boost   ASC,    -- 0 = boosted (paid), 1 = normal
  active  DESC,   -- recently active first (app feels alive)
  distance ASC    -- closer first (relevance)
```

**Why this order matters:**
1. **Boost first** = direct revenue. Users see the effect immediately = they buy more
2. **Active first** = app feels alive even with low user count. Dead profiles sink to bottom
3. **Distance last** = still relevant, but an active user 3km away beats an inactive user 1km away


## 13 Tables Summary

| # | Table | Write Freq | Purpose |
|---|-------|-----------|---------|
| 1 | users | LOW | Auth credentials, account flags |
| 2 | user_profiles | LOW | Display data (nickname, bio, tags) |
| 3 | user_locations | VERY HIGH | GPS position, PostGIS geography |
| 4 | user_metrics | HIGH | Counters, online status, last_active |
| 5 | user_preferences | LOW | Matching preferences (age, distance) |
| 6 | swipes | HIGH | Like/pass records |
| 7 | matches | MEDIUM | Mutual likes |
| 8 | messages | HIGH | Chat messages |
| 9 | reports | LOW | Moderation reports |
| 10 | blocks | LOW | User blocks |
| 11 | subscriptions | LOW | Premium subscription records |
| 12 | transactions | MEDIUM | Payment audit trail (append-only) |
| 13 | boosts | LOW | Visibility boost windows |
