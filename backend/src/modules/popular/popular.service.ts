import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

@Injectable()
export class PopularService {
  constructor(private readonly dataSource: DataSource) {}

  // ── Get today's popular list for a country ────────────────────────────────

  async getPopular(countryCode: string) {
    const rows = await this.dataSource.query<any[]>(
      `
      SELECT
        pf.rank,
        pf.source,
        p.user_id AS id,
        p.nickname,
        p.height,
        p.weight,
        p.country_code,
        m.is_online,
        m.last_active,
        ph.photos,
        u.is_premium
      FROM popular_featured pf
      JOIN user_profiles p  ON p.user_id = pf.user_id
      JOIN user_metrics  m  ON m.user_id = pf.user_id
      JOIN users         u  ON u.id      = pf.user_id
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(url ORDER BY position) AS photos
        FROM user_photos WHERE user_id = pf.user_id
      ) ph ON true
      WHERE pf.feature_date  = CURRENT_DATE
        AND pf.country_code  = $1
        AND u.is_banned      = false
      ORDER BY pf.rank ASC
      LIMIT 10
      `,
      [countryCode.toUpperCase()],
    );

    return rows.map((r) => ({
      rank: r.rank,
      source: r.source,
      user: {
        id: r.id,
        nickname: r.nickname,
        height: r.height,
        weight: r.weight,
        countryCode: r.country_code,
        isOnline: r.is_online,
        lastActive: r.last_active,
        isPremium: r.is_premium,
        photos: r.photos ?? [],
        avatarUrl: r.photos?.[0] ?? null,
      },
    }));
  }

  // ── Use a popularity ticket ───────────────────────────────────────────────

  async useTicket(userId: string, countryCode: string) {
    // Check user has an unused valid ticket
    const ticket = await this.dataSource.query<any[]>(
      `
      SELECT id FROM popularity_tickets
      WHERE user_id   = $1
        AND used_at   IS NULL
        AND expires_at > NOW()
      ORDER BY created_at ASC
      LIMIT 1
      `,
      [userId],
    );

    if (!ticket.length) {
      throw new NotFoundException(
        'No valid popularity ticket found. Purchase one to feature your profile.',
      );
    }

    // Count current ticket-sourced entries today for this country
    const ticketCount = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*) FROM popular_featured
       WHERE feature_date = CURRENT_DATE AND country_code = $1 AND source = 'ticket'`,
      [countryCode],
    );

    // Determine rank (system picks 1-10, ticket gets 11+)
    const nextRank = 10 + parseInt(ticketCount[0].count) + 1;

    // Mark ticket used
    await this.dataSource.query(
      `UPDATE popularity_tickets SET used_at = NOW() WHERE id = $1`,
      [ticket[0].id],
    );

    // Insert into popular_featured (upsert to handle re-use edge case)
    await this.dataSource.query(
      `
      INSERT INTO popular_featured (user_id, country_code, rank, source)
      VALUES ($1, $2, $3, 'ticket')
      ON CONFLICT (user_id, country_code, feature_date)
      DO UPDATE SET rank = EXCLUDED.rank, source = 'ticket'
      `,
      [userId, countryCode.toUpperCase(), nextRank],
    );

    return { success: true, rank: nextRank };
  }

  // ── Purchase a ticket (mock — integrate payment gateway later) ────────────

  async purchaseTicket(userId: string) {
    // In production: verify payment receipt from App Store / Stripe first
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.dataSource.query(
      `INSERT INTO popularity_tickets (user_id, expires_at) VALUES ($1, $2)`,
      [userId, expiresAt],
    );

    return { success: true, expiresAt };
  }

  // ── Daily refresh (called by cron / scheduled task) ───────────────────────

  async refreshDailyPopular() {
    await this.dataSource.query(`
      INSERT INTO popular_featured (user_id, country_code, rank, source)
      SELECT
        sub.user_id,
        sub.country_code,
        sub.rank,
        'system'
      FROM (
        SELECT
          p.user_id,
          p.country_code,
          ROW_NUMBER() OVER (
            PARTITION BY p.country_code
            ORDER BY m.profile_views DESC, m.likes_received DESC
          ) AS rank
        FROM user_profiles p
        JOIN user_metrics  m ON m.user_id = p.user_id
        JOIN users         u ON u.id      = p.user_id
        WHERE u.is_banned      = false
          AND p.country_code   IS NOT NULL
      ) sub
      WHERE sub.rank <= 10
      ON CONFLICT (user_id, country_code, feature_date) DO NOTHING
    `);
    return { success: true };
  }
}
