import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Swipe } from './swipe.entity';
import { Match } from './match.entity';
import { User } from '../user/user.entity';
import { UserProfile } from '../user/user-profile.entity';
import { UserMetrics } from '../user/user-metrics.entity';
import { SwipeDto } from './dto/swipe.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MatchService {
  private freeSwipeLimit: number;

  constructor(
    @InjectRepository(Swipe)
    private readonly swipeRepository: Repository<Swipe>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @InjectRepository(UserMetrics)
    private readonly metricsRepository: Repository<UserMetrics>,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {
    this.freeSwipeLimit = configService.get<number>('FREE_DAILY_SWIPE_LIMIT', 20);
  }

  async swipe(userId: string, dto: SwipeDto) {
    if (userId === dto.targetUserId) {
      throw new BadRequestException('Cannot swipe yourself');
    }

    // Check daily swipe limit from user_metrics
    const user = await this.userRepository.findOneOrFail({ where: { id: userId } });
    const metrics = await this.metricsRepository.findOneOrFail({ where: { userId } });

    if (!user.isPremium) {
      const today = new Date().toISOString().split('T')[0];
      const resetDate = metrics.swipesReset
        ? new Date(metrics.swipesReset).toISOString().split('T')[0]
        : null;
      if (resetDate !== today) {
        await this.metricsRepository.update(userId, {
          dailySwipes: 0,
          swipesReset: new Date(),
        });
        metrics.dailySwipes = 0;
      }

      if (metrics.dailySwipes >= this.freeSwipeLimit) {
        throw new ForbiddenException(
          `Daily swipe limit reached (${this.freeSwipeLimit}). Upgrade to premium for unlimited swipes.`,
        );
      }
    }

    // Check if already swiped
    const existingSwipe = await this.swipeRepository.findOne({
      where: { swiperId: userId, swipedId: dto.targetUserId },
    });

    if (existingSwipe) {
      throw new BadRequestException('Already swiped on this user');
    }

    // Create swipe
    const swipe = this.swipeRepository.create({
      swiperId: userId,
      swipedId: dto.targetUserId,
      direction: dto.direction,
    });
    await this.swipeRepository.save(swipe);

    // Increment counters in user_metrics (isolated table)
    await this.metricsRepository
      .createQueryBuilder()
      .update(UserMetrics)
      .set({
        dailySwipes: () => '"daily_swipes" + 1',
        totalSwipes: () => '"total_swipes" + 1',
        lastActive: new Date(),
      })
      .where('"user_id" = :userId', { userId })
      .execute();

    // Check for mutual like → create match
    let isMatch = false;
    let matchId: string | undefined;

    if (dto.direction === 'like') {
      const reciprocal = await this.swipeRepository.findOne({
        where: {
          swiperId: dto.targetUserId,
          swipedId: userId,
          direction: 'like',
        },
      });

      if (reciprocal) {
        const [user1Id, user2Id] =
          userId < dto.targetUserId
            ? [userId, dto.targetUserId]
            : [dto.targetUserId, userId];

        const existingMatch = await this.matchRepository.findOne({
          where: { user1Id, user2Id },
        });

        if (!existingMatch) {
          const match = this.matchRepository.create({ user1Id, user2Id });
          const saved = await this.matchRepository.save(match);
          isMatch = true;
          matchId = saved.id;

          // Increment match counter for both users
          await this.metricsRepository
            .createQueryBuilder()
            .update(UserMetrics)
            .set({ totalMatches: () => '"total_matches" + 1' })
            .where('"user_id" IN (:...ids)', { ids: [userId, dto.targetUserId] })
            .execute();

          // 🔔 Push notification: "It's a Match!"
          this.notificationService
            .sendMatchNotification(userId, dto.targetUserId, saved.id)
            .catch(() => {}); // fire-and-forget
        }
      }

      // 🔔 Push notification: "Someone liked you!" (no match yet)
      if (!isMatch && dto.direction === 'like') {
        this.notificationService
          .sendLikeNotification(dto.targetUserId, userId)
          .catch(() => {}); // fire-and-forget
      }
    }

    return { isMatch, matchId };
  }

  async getMatches(userId: string) {
    const matches = await this.matchRepository.find({
      where: [{ user1Id: userId }, { user2Id: userId }],
      order: { createdAt: 'DESC' },
    });

    const result = await Promise.all(
      matches.map(async (match) => {
        const otherUserId =
          match.user1Id === userId ? match.user2Id : match.user1Id;

        const [profile, metrics] = await Promise.all([
          this.profileRepository.findOne({ where: { userId: otherUserId } }),
          this.metricsRepository.findOne({ where: { userId: otherUserId } }),
        ]);

        return {
          matchId: match.id,
          matchedAt: match.createdAt,
          user: {
            id: otherUserId,
            nickname: profile?.nickname,
            avatarUrl: profile?.avatarUrl,
            bio: profile?.bio,
            isOnline: metrics?.isOnline ?? false,
          },
        };
      }),
    );

    return result;
  }

  async unmatch(userId: string, matchId: string) {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });

    if (!match) throw new NotFoundException('Match not found');

    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new ForbiddenException('Not your match');
    }

    await this.matchRepository.remove(match);
    return { message: 'Unmatched successfully' };
  }

  async getLikes(userId: string) {
    const likes = await this.swipeRepository
      .createQueryBuilder('swipe')
      .where('swipe.swipedId = :userId', { userId })
      .andWhere('swipe.direction = :direction', { direction: 'like' })
      .andWhere(
        `swipe.swiperId NOT IN (
          SELECT "swiped_id" FROM swipes WHERE "swiper_id" = :userId
        )`,
      )
      .orderBy('swipe.createdAt', 'DESC')
      .getMany();

    const result = await Promise.all(
      likes.map(async (swipe) => {
        const profile = await this.profileRepository.findOne({
          where: { userId: swipe.swiperId },
        });
        return {
          id: swipe.swiperId,
          nickname: profile?.nickname,
          avatarUrl: profile?.avatarUrl,
          likedAt: swipe.createdAt,
        };
      }),
    );

    return result;
  }
}
