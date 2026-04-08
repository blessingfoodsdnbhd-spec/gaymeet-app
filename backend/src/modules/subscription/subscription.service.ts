import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { User } from '../user/user.entity';
import { Subscription } from './subscription.entity';
import { Transaction } from './transaction.entity';
import { Boost } from './boost.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Boost)
    private readonly boostRepository: Repository<Boost>,
  ) {}

  async getStatus(userId: string) {
    const user = await this.userRepository.findOneOrFail({ where: { id: userId } });

    const activeSub = await this.subscriptionRepository.findOne({
      where: { userId, status: 'active' },
      order: { expiresAt: 'DESC' },
    });

    const activeBoost = await this.boostRepository
      .createQueryBuilder('boost')
      .where('boost.userId = :userId', { userId })
      .andWhere('boost.endsAt > NOW()')
      .getOne();

    return {
      isPremium: user.isPremium,
      subscription: activeSub
        ? {
            plan: activeSub.plan,
            expiresAt: activeSub.expiresAt,
            platform: activeSub.platform,
          }
        : null,
      boost: activeBoost
        ? {
            endsAt: activeBoost.endsAt,
          }
        : null,
      features: user.isPremium
        ? ['unlimited_swipes', 'see_likes', 'hide_distance', 'boost']
        : ['limited_swipes'],
    };
  }

  async verifyReceipt(
    userId: string,
    receipt: string,
    platform: 'ios' | 'android',
    plan: 'monthly' | 'yearly' = 'monthly',
  ) {
    // TODO: Validate receipt with Apple/Google servers in production
    // For MVP: trust the receipt and activate

    const now = new Date();
    const expiresAt = new Date(now);
    if (plan === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Create subscription record
    const subscription = this.subscriptionRepository.create({
      userId,
      plan,
      platform,
      platformTxnId: receipt,
      startsAt: now,
      expiresAt,
      status: 'active',
    });
    await this.subscriptionRepository.save(subscription);

    // Create transaction record (audit trail)
    const amountCents = plan === 'monthly' ? 999 : 7999;
    const transaction = this.transactionRepository.create({
      userId,
      type: 'subscription',
      amountCents,
      currency: 'USD',
      platform,
      platformTxnId: receipt,
      status: 'completed',
    });
    await this.transactionRepository.save(transaction);

    // Flip premium flag
    await this.userRepository.update(userId, { isPremium: true });

    return {
      isPremium: true,
      subscription: { plan, expiresAt, platform },
      message: 'Subscription activated',
    };
  }

  async purchaseBoost(userId: string, platform: 'ios' | 'android') {
    const user = await this.userRepository.findOneOrFail({ where: { id: userId } });

    // Check if already boosted
    const existingBoost = await this.boostRepository
      .createQueryBuilder('boost')
      .where('boost.userId = :userId', { userId })
      .andWhere('boost.endsAt > NOW()')
      .getOne();

    if (existingBoost) {
      throw new BadRequestException('You already have an active boost');
    }

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setMinutes(endsAt.getMinutes() + 30); // 30-minute boost

    const boost = this.boostRepository.create({
      userId,
      startsAt: now,
      endsAt,
    });
    await this.boostRepository.save(boost);

    // Record transaction
    const transaction = this.transactionRepository.create({
      userId,
      type: 'boost',
      amountCents: 499, // $4.99
      currency: 'USD',
      platform,
      status: 'completed',
    });
    await this.transactionRepository.save(transaction);

    return {
      boost: { startsAt: now, endsAt },
      message: 'Boost activated for 30 minutes',
    };
  }

  /**
   * Cron job: expire subscriptions and flip is_premium flag.
   * Run daily via: NestJS @Cron('0 0 * * *')
   */
  async expireSubscriptions() {
    const expired = await this.subscriptionRepository.find({
      where: {
        status: 'active',
        expiresAt: LessThan(new Date()),
      },
    });

    for (const sub of expired) {
      await this.subscriptionRepository.update(sub.id, { status: 'expired' });

      // Check if user has any other active subscription
      const otherActive = await this.subscriptionRepository.findOne({
        where: { userId: sub.userId, status: 'active' },
      });

      if (!otherActive) {
        await this.userRepository.update(sub.userId, { isPremium: false });
      }
    }

    return { expired: expired.length };
  }
}
