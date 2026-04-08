/**
 * GayMeet Seed Script — 50 realistic users across Tokyo
 *
 * Usage: npx ts-node src/database/seed.ts
 *
 * Creates users with profiles, locations, metrics, preferences,
 * and some pre-existing swipes/matches so the app feels alive.
 */

import { Client } from 'pg';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

const client = new Client({
  host: 'localhost',
  port: 5433,
  user: 'gaymeet',
  password: 'gaymeet_dev_password',
  database: 'gaymeet',
});

// Tokyo neighborhoods with realistic coordinates
const LOCATIONS: [string, number, number][] = [
  ['Shibuya',     35.6598, 139.7006],
  ['Shinjuku',    35.6896, 139.6921],
  ['Roppongi',    35.6627, 139.7311],
  ['Ikebukuro',   35.7295, 139.7109],
  ['Harajuku',    35.6702, 139.7027],
  ['Ginza',       35.6717, 139.7649],
  ['Akihabara',   35.7023, 139.7745],
  ['Ebisu',       35.6467, 139.7100],
  ['Nakameguro',  35.6441, 139.6988],
  ['Daikanyama',  35.6487, 139.7032],
  ['Shimokita',   35.6612, 139.6688],
  ['Ueno',        35.7141, 139.7774],
  ['Asakusa',     35.7148, 139.7967],
  ['Odaiba',      35.6270, 139.7750],
  ['Meguro',      35.6339, 139.7157],
  ['Azabu',       35.6532, 139.7371],
  ['Yoyogi',      35.6832, 139.7020],
  ['Koenji',      35.7065, 139.6497],
  ['Sangenjaya',  35.6435, 139.6706],
  ['Nihonbashi',  35.6839, 139.7745],
];

const TAGS = [
  'travel', 'fitness', 'coffee', 'music', 'photography',
  'cooking', 'hiking', 'gaming', 'dogs', 'cats',
  'yoga', 'nightlife', 'art', 'tech', 'books',
  'movies', 'wine', 'beach', 'running', 'dance',
  'surfing', 'cycling', 'tattoos', 'fashion', 'foodie',
];

const BIOS = [
  'Coffee addict. Dog lover. Always down for ramen.',
  'Photographer by day. DJ by night. Let\'s go on an adventure.',
  'Just moved here. Looking for friends and maybe more.',
  'Yoga instructor. Plant-based. Love hiking on weekends.',
  'Software engineer who actually goes outside sometimes.',
  'Originally from Osaka. Love surfing and sunsets.',
  'Bookworm. Jazz enthusiast. Deep conversations only.',
  'Gym rat by morning, foodie by night. Show me your fav spot.',
  'Architect. Design nerd. Obsessed with good coffee.',
  'Teacher by day, gamer by night. Chill vibes only.',
  'Marketing creative. Weekend wanderer. Dog dad.',
  'PhD student. Science nerd who cleans up well.',
  'Chef in training. Will cook you dinner on the 3rd date.',
  'Film director. Always on set or at a izakaya.',
  'Nurse. Kind heart. Looking for something real.',
  'Freelance designer. Matcha obsessed. Cat person.',
  'Personal trainer. Will spot you at the gym 😏',
  'Bartender at a speakeasy in Ginza. Night owl.',
  'Language teacher. Fluent in 4 languages. Teach me yours.',
  'Startup founder. Hustle hard, play harder.',
  'Musician. Guitar + piano. Will write you a song.',
  'Data scientist. Numbers by day, dance floor by night.',
  'Fashion buyer. Always overdressed. No regrets.',
  'Pilot. Not home often, but worth the wait.',
  'Dancer. Contemporary + hip-hop. Flexible in every way.',
];

const NAMES = [
  'Yuto', 'Haruki', 'Sota', 'Riku', 'Kaito',
  'Ren', 'Takumi', 'Kota', 'Hayato', 'Shota',
  'Alex', 'Marcus', 'Daniel', 'Ryan', 'James',
  'Tomas', 'Leo', 'Noah', 'Kai', 'Max',
  'Kenji', 'Daiki', 'Naoki', 'Hiroshi', 'Tatsuya',
  'Chris', 'Mike', 'Sam', 'Jake', 'Ethan',
  'Yuki', 'Kenta', 'Sho', 'Ryo', 'Tsubasa',
  'Jordan', 'Blake', 'Ash', 'Drew', 'Finn',
  'Akira', 'Shin', 'Jun', 'Hiro', 'Masa',
  'Liam', 'Oliver', 'Ben', 'Tom', 'David',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTags(count: number): string[] {
  const shuffled = [...TAGS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function jitterCoord(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range;
}

async function seed() {
  await client.connect();
  console.log('Connected to database');

  // Clean existing data
  await client.query('DELETE FROM swipes');
  await client.query('DELETE FROM matches');
  await client.query('DELETE FROM messages');
  await client.query('DELETE FROM blocks');
  await client.query('DELETE FROM reports');
  await client.query('DELETE FROM boosts');
  await client.query('DELETE FROM subscriptions');
  await client.query('DELETE FROM transactions');
  await client.query('DELETE FROM user_locations');
  await client.query('DELETE FROM user_metrics');
  await client.query('DELETE FROM user_profiles');
  await client.query('DELETE FROM user_preferences');
  await client.query('DELETE FROM users');
  console.log('Cleaned existing data');

  // Disable the auto-create trigger (we insert child rows manually)
  await client.query('ALTER TABLE users DISABLE TRIGGER trg_user_after_insert');

  const passwordHash = await bcrypt.hash('pass123456', 12);
  const userIds: string[] = [];

  // Create 50 users
  for (let i = 0; i < 50; i++) {
    const id = uuid();
    userIds.push(id);
    const name = NAMES[i];
    const email = `${name.toLowerCase()}${i}@gaymeet.app`;
    const bio = BIOS[i % BIOS.length];
    const tags = randomTags(3 + Math.floor(Math.random() * 3));
    const [area, baseLat, baseLng] = LOCATIONS[i % LOCATIONS.length];
    const lat = jitterCoord(baseLat, 0.01);
    const lng = jitterCoord(baseLng, 0.01);
    const isPremium = i < 5; // First 5 users are premium
    const isOnline = Math.random() > 0.5;
    const avatarIdx = (i % 70) + 1; // pravatar.cc has 70 images

    // Insert user (auth)
    await client.query(
      `INSERT INTO users (id, email, password_hash, provider, is_premium, is_verified)
       VALUES ($1, $2, $3, 'local', $4, $5)`,
      [id, email, passwordHash, isPremium, i < 10],
    );

    // Insert profile
    await client.query(
      `INSERT INTO user_profiles (user_id, nickname, avatar_url, bio, tags)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, name, `https://i.pravatar.cc/400?img=${avatarIdx}`, bio, tags],
    );

    // Insert location with PostGIS
    await client.query(
      `INSERT INTO user_locations (user_id, latitude, longitude, location, updated_at)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, NOW() - interval '${Math.floor(Math.random() * 60)} minutes')`,
      [id, lat, lng],
    );

    // Insert metrics
    await client.query(
      `INSERT INTO user_metrics (user_id, daily_swipes, is_online, last_active, total_swipes, total_matches)
       VALUES ($1, $2, $3, NOW() - interval '${Math.floor(Math.random() * 120)} minutes', $4, $5)`,
      [id, Math.floor(Math.random() * 15), isOnline, Math.floor(Math.random() * 200), Math.floor(Math.random() * 20)],
    );

    // Insert preferences
    await client.query(
      `INSERT INTO user_preferences (user_id, age_min, age_max, distance_max_km)
       VALUES ($1, $2, $3, $4)`,
      [id, 18 + Math.floor(Math.random() * 5), 35 + Math.floor(Math.random() * 15), 10 + Math.floor(Math.random() * 40)],
    );

    console.log(`  ${i + 1}/50  ${name.padEnd(10)} ${area.padEnd(12)} ${isOnline ? '🟢' : '⚪'} ${isPremium ? '⭐' : '  '}`);
  }

  // Create some swipes (200 random)
  console.log('\nCreating 200 random swipes...');
  let swipeCount = 0;
  for (let s = 0; s < 200; s++) {
    const i = Math.floor(Math.random() * 50);
    const j = Math.floor(Math.random() * 50);
    if (i === j) continue;
    const dir = Math.random() > 0.3 ? 'like' : 'pass';
    try {
      await client.query(
        `INSERT INTO swipes (swiper_id, swiped_id, direction)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [userIds[i], userIds[j], dir],
      );
      swipeCount++;
    } catch { /* skip dupes */ }
  }
  console.log(`  Created ${swipeCount} swipes`);

  // Create matches from mutual likes
  console.log('Creating matches from mutual likes...');
  const matchResult = await client.query(`
    SELECT DISTINCT
      LEAST(a.swiper_id, a.swiped_id) AS user1_id,
      GREATEST(a.swiper_id, a.swiped_id) AS user2_id
    FROM swipes a
    JOIN swipes b ON a.swiper_id = b.swiped_id AND a.swiped_id = b.swiper_id
    WHERE a.direction = 'like' AND b.direction = 'like'
      AND a.swiper_id < a.swiped_id
  `);

  let matchCount = 0;
  for (const row of matchResult.rows) {
    try {
      await client.query(
        `INSERT INTO matches (user1_id, user2_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [row.user1_id, row.user2_id],
      );
      matchCount++;
    } catch { /* skip dupes */ }
  }
  console.log(`  Created ${matchCount} matches`);

  // Add some messages to matches
  console.log('Adding messages to matches...');
  const matches = await client.query('SELECT id, user1_id, user2_id FROM matches LIMIT 10');
  const greetings = [
    'Hey! 👋', 'Hi there!', 'Nice to match with you!',
    'How\'s it going?', 'What are you up to?', 'Love your profile!',
    'Hi! What brings you to Tokyo?', 'Hey cutie 😊',
  ];
  let msgCount = 0;
  for (const m of matches.rows) {
    const numMsgs = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < numMsgs; k++) {
      const sender = k % 2 === 0 ? m.user1_id : m.user2_id;
      await client.query(
        `INSERT INTO messages (match_id, sender_id, content, created_at)
         VALUES ($1, $2, $3, NOW() - interval '${numMsgs - k} hours')`,
        [m.id, sender, randomItem(greetings)],
      );
      msgCount++;
    }
  }
  console.log(`  Created ${msgCount} messages across ${matches.rows.length} conversations`);

  // Add 2 active boosts
  console.log('Adding active boosts...');
  await client.query(
    `INSERT INTO boosts (user_id, starts_at, ends_at)
     VALUES ($1, NOW(), NOW() + interval '30 minutes')`,
    [userIds[1]],
  );
  await client.query(
    `INSERT INTO boosts (user_id, starts_at, ends_at)
     VALUES ($1, NOW(), NOW() + interval '30 minutes')`,
    [userIds[7]],
  );

  // Summary
  const counts = await client.query(`
    SELECT
      (SELECT count(*) FROM users) AS users,
      (SELECT count(*) FROM user_profiles) AS profiles,
      (SELECT count(*) FROM user_locations WHERE location IS NOT NULL) AS locations,
      (SELECT count(*) FROM swipes) AS swipes,
      (SELECT count(*) FROM matches) AS matches,
      (SELECT count(*) FROM messages) AS messages,
      (SELECT count(*) FROM boosts WHERE ends_at > NOW()) AS active_boosts
  `);
  const c = counts.rows[0];
  console.log('\n=========================================');
  console.log('  SEED COMPLETE');
  console.log('=========================================');
  console.log(`  Users:         ${c.users}`);
  console.log(`  Profiles:      ${c.profiles}`);
  console.log(`  Locations:     ${c.locations}`);
  console.log(`  Swipes:        ${c.swipes}`);
  console.log(`  Matches:       ${c.matches}`);
  console.log(`  Messages:      ${c.messages}`);
  console.log(`  Active Boosts: ${c.active_boosts}`);
  console.log('=========================================');
  // Re-enable trigger
  await client.query('ALTER TABLE users ENABLE TRIGGER trg_user_after_insert');

  console.log(`\n  All users password: pass123456`);
  console.log(`  Login as: alex0@gaymeet.app / marcus1@gaymeet.app / etc.`);

  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
