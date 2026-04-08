import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { Shout } from './entities/shout.entity';

const NEARBY_RADIUS_KM = 50;

@Injectable()
export class ShoutService {
  constructor(
    @InjectRepository(Shout)
    private readonly shoutRepo: Repository<Shout>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Post a shout ──────────────────────────────────────────────────────────

  async postShout(
    userId: string,
    content: string,
    latitude: number,
    longitude: number,
  ) {
    // One active shout per user at a time — delete existing if any
    await this.dataSource.query(
      `DELETE FROM shouts WHERE user_id = $1`,
      [userId],
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const shout = this.shoutRepo.create({
      userId,
      content,
      latitude,
      longitude,
      expiresAt,
    });
    return this.shoutRepo.save(shout);
  }

  // ── Get nearby shouts ─────────────────────────────────────────────────────

  async getNearbyShouts(
    userId: string,
    latitude: number,
    longitude: number,
    radiusKm: number = NEARBY_RADIUS_KM,
  ) {
    // Haversine bounding-box filter then exact distance calculation
    const rows = await this.dataSource.query<any[]>(
      `
      SELECT
        s.id,
        s.content,
        s.expires_at,
        s.created_at,
        -- Haversine distance in km
        6371 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS(s.latitude  - $2) / 2), 2) +
          COS(RADIANS($2)) * COS(RADIANS(s.latitude)) *
          POWER(SIN(RADIANS(s.longitude - $3) / 2), 2)
        )) AS distance_km,
        p.nickname,
        p.height,
        p.weight,
        p.country_code,
        m.is_online,
        m.last_active,
        ph.photos,
        u.is_premium
      FROM shouts s
      JOIN users            u  ON u.id       = s.user_id
      JOIN user_profiles    p  ON p.user_id  = s.user_id
      JOIN user_metrics     m  ON m.user_id  = s.user_id
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(url ORDER BY position) AS photos
        FROM user_photos WHERE user_id = s.user_id
      ) ph ON true
      WHERE s.user_id   != $1
        AND s.expires_at > NOW()
        AND u.is_banned  = false
        AND 6371 * 2 * ASIN(SQRT(
              POWER(SIN(RADIANS(s.latitude  - $2) / 2), 2) +
              COS(RADIANS($2)) * COS(RADIANS(s.latitude)) *
              POWER(SIN(RADIANS(s.longitude - $3) / 2), 2)
            )) <= $4
      ORDER BY distance_km ASC
      LIMIT 50
      `,
      [userId, latitude, longitude, radiusKm],
    );

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      distance: parseFloat(r.distance_km),
      user: {
        id: r.user_id,
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

  // ── Delete own shout ──────────────────────────────────────────────────────

  async deleteShout(userId: string) {
    await this.dataSource.query(
      `DELETE FROM shouts WHERE user_id = $1`,
      [userId],
    );
    return { success: true };
  }

  // ── Get own active shout ──────────────────────────────────────────────────

  async getMyShout(userId: string) {
    return this.shoutRepo.findOne({
      where: { userId, expiresAt: MoreThan(new Date()) },
    });
  }
}
