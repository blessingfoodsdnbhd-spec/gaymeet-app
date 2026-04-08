import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client } from '../../config/s3.config';
import { User } from './user.entity';
import { UserProfile } from './user-profile.entity';
import { UserLocation } from './user-location.entity';
import { UserMetrics } from './user-metrics.entity';
import { UserPreferences } from './user-preferences.entity';
import { UpdateProfileDto, UpdateLocationDto, UpdatePreferencesDto } from './dto/update-profile.dto';
import { v4 as uuid } from 'uuid';

@Injectable()
export class UserService {
  private s3Client: S3Client;
  private bucket: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @InjectRepository(UserLocation)
    private readonly locationRepository: Repository<UserLocation>,
    @InjectRepository(UserMetrics)
    private readonly metricsRepository: Repository<UserMetrics>,
    @InjectRepository(UserPreferences)
    private readonly preferencesRepository: Repository<UserPreferences>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.s3Client = getS3Client(configService);
    this.bucket = configService.get<string>('S3_BUCKET', 'gaymeet-media');
  }

  /**
   * Get full user profile (joins auth + profile + metrics)
   */
  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [profile, metrics, preferences] = await Promise.all([
      this.profileRepository.findOne({ where: { userId } }),
      this.metricsRepository.findOne({ where: { userId } }),
      this.preferencesRepository.findOne({ where: { userId } }),
    ]);

    return {
      id: user.id,
      email: user.email,
      isPremium: user.isPremium,
      isVerified: user.isVerified,
      nickname: profile?.nickname,
      avatarUrl: profile?.avatarUrl,
      bio: profile?.bio,
      birthday: profile?.birthday,
      tags: profile?.tags ?? [],
      isOnline: metrics?.isOnline ?? false,
      lastActive: metrics?.lastActive,
      preferences: preferences
        ? {
            ageMin: preferences.ageMin,
            ageMax: preferences.ageMax,
            distanceMaxKm: preferences.distanceMaxKm,
            tagsPreference: preferences.tagsPreference,
            showOnlineOnly: preferences.showOnlineOnly,
            hideDistance: preferences.hideDistance,
          }
        : null,
      createdAt: user.createdAt,
    };
  }

  /**
   * Get another user's public profile
   */
  async getUserById(userId: string, _requesterId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [profile, metrics] = await Promise.all([
      this.profileRepository.findOne({ where: { userId } }),
      this.metricsRepository.findOne({ where: { userId } }),
    ]);

    return {
      id: user.id,
      nickname: profile?.nickname,
      avatarUrl: profile?.avatarUrl,
      bio: profile?.bio,
      tags: profile?.tags ?? [],
      isOnline: metrics?.isOnline ?? false,
      lastActive: metrics?.lastActive,
      isPremium: user.isPremium,
    };
  }

  /**
   * Update profile fields (nickname, bio, tags, birthday)
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.profileRepository.update(userId, dto);
    return this.getProfile(userId);
  }

  /**
   * Update user preferences (age range, distance, etc.)
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.preferencesRepository.update(userId, dto);
    return this.getProfile(userId);
  }

  /**
   * Update GPS location — HIGH FREQUENCY (every 30s)
   * Writes ONLY to user_locations table (isolated from auth/profile)
   */
  async updateLocation(userId: string, dto: UpdateLocationDto) {
    await this.locationRepository
      .createQueryBuilder()
      .update(UserLocation)
      .set({
        latitude: dto.latitude,
        longitude: dto.longitude,
        location: () =>
          `ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography`,
      })
      .where('"user_id" = :id', { id: userId })
      .execute();

    // Also bump last_active in metrics
    await this.metricsRepository.update(userId, { lastActive: new Date() });

    return { message: 'Location updated' };
  }

  /**
   * THE KEY QUERY: Nearby users with smart ranking
   *
   * Joins: user_locations (GIST scan) → users (ban check) →
   *        user_profiles (display) → user_metrics (presence) →
   *        boosts (priority sort)
   *
   * Sort order:
   *   1. Boosted users first (paid visibility)
   *   2. Recently active first (app feels alive)
   *   3. Closer first (relevance)
   */
  async getNearbyUsers(
    userId: string,
    radius: number = 10,
    page: number = 1,
    limit: number = 20,
  ) {
    const radiusMeters = radius * 1000;
    const offset = (page - 1) * limit;

    const users = await this.dataSource.query(
      `
      SELECT
        u.id,
        p.nickname,
        p."avatar_url"       AS "avatarUrl",
        p.bio,
        p.tags,
        m."is_online"        AS "isOnline",
        m."last_active"      AS "lastActive",
        ST_Distance(
          l.location,
          (SELECT location FROM user_locations WHERE "user_id" = $1)
        ) AS distance_m,
        CASE WHEN b.id IS NOT NULL THEN true ELSE false END AS "isBoosted"
      FROM user_locations l
      JOIN users u            ON u.id = l."user_id"
      JOIN user_profiles p    ON p."user_id" = l."user_id"
      JOIN user_metrics m     ON m."user_id" = l."user_id"
      LEFT JOIN boosts b      ON b."user_id" = l."user_id"
                              AND b."ends_at" > NOW()
      WHERE l."user_id" != $1
        AND u."is_banned" = false
        AND u."is_shadow_banned" = false
        AND l.location IS NOT NULL
        AND ST_DWithin(
              l.location,
              (SELECT location FROM user_locations WHERE "user_id" = $1),
              $2
            )
        AND l."updated_at" > NOW() - INTERVAL '30 days'
        AND l."user_id" NOT IN (
            SELECT "blocked_id" FROM blocks WHERE "blocker_id" = $1
            UNION ALL
            SELECT "blocker_id" FROM blocks WHERE "blocked_id" = $1
        )
        AND l."user_id" NOT IN (
            SELECT "swiped_id" FROM swipes WHERE "swiper_id" = $1
        )
      ORDER BY
        (CASE WHEN b.id IS NOT NULL THEN 0 ELSE 1 END) ASC,
        m."last_active" DESC,
        distance_m ASC
      LIMIT $3 OFFSET $4
      `,
      [userId, radiusMeters, limit, offset],
    );

    return users.map((u: any) => ({
      ...u,
      distance: u.distance_m ? Math.round((u.distance_m / 1000) * 10) / 10 : null,
    }));
  }

  /**
   * Get presigned S3 upload URL for avatar
   */
  async getAvatarUploadUrl(userId: string) {
    const key = `avatars/${userId}/${uuid()}.jpg`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: 'image/jpeg',
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 300,
    });

    const avatarUrl = `https://${this.bucket}.s3.amazonaws.com/${key}`;
    await this.profileRepository.update(userId, { avatarUrl });

    return { uploadUrl, avatarUrl };
  }

  /**
   * Update online/offline status — called by Socket.io gateway
   * Writes ONLY to user_metrics (isolated)
   */
  async setOnlineStatus(userId: string, isOnline: boolean) {
    await this.metricsRepository.update(userId, {
      isOnline,
      lastActive: new Date(),
    });
  }

  async setVirtualLocation(
    userId: string,
    dto: { latitude: number; longitude: number; label?: string },
  ) {
    await this.preferencesRepository.upsert(
      {
        userId,
        virtualLat: dto.latitude,
        virtualLng: dto.longitude,
        virtualLocationLabel: dto.label ?? null,
      },
      ['userId'],
    );
    return { success: true };
  }

  async clearVirtualLocation(userId: string) {
    await this.preferencesRepository.update(userId, {
      virtualLat: null,
      virtualLng: null,
      virtualLocationLabel: null,
    });
    return { success: true };
  }

  async setStealthMode(userId: string, enabled: boolean) {
    await this.preferencesRepository.upsert(
      { userId, stealthMode: enabled },
      ['userId'],
    );
    return { success: true, stealthMode: enabled };
  }
}
