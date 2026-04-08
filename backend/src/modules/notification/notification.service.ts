import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { UserMetrics } from '../user/user-metrics.entity';
import { UserProfile } from '../user/user-profile.entity';

/**
 * Push notification service via Firebase Cloud Messaging (FCM).
 *
 * Handles 3 notification types:
 *   1. NEW_MATCH  — "You matched with Alex!"
 *   2. NEW_MESSAGE — "Alex: Hey! 👋"
 *   3. NEW_LIKE    — "Someone liked you!" (premium only reveals who)
 */

export enum NotificationType {
  NEW_MATCH = 'new_match',
  NEW_MESSAGE = 'new_message',
  NEW_LIKE = 'new_like',
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private firebaseInitialized = false;

  constructor(
    @InjectRepository(UserMetrics)
    private readonly metricsRepository: Repository<UserMetrics>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
  ) {}

  onModuleInit() {
    try {
      // Initialize Firebase Admin if credentials exist
      // Place your service account JSON at backend/firebase-service-account.json
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccountPath) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.firebaseInitialized = true;
        this.logger.log('Firebase Admin initialized ✓');
      } else {
        this.logger.warn(
          'FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled. ' +
          'Set the env var to enable FCM.',
        );
      }
    } catch (err) {
      this.logger.error('Firebase init failed:', err);
    }
  }

  /**
   * Register/update a user's FCM device token.
   * Called from Flutter on app start + token refresh.
   */
  async registerDeviceToken(userId: string, token: string): Promise<void> {
    await this.metricsRepository.update(userId, { deviceToken: token });
    this.logger.debug(`Device token registered for user ${userId}`);
  }

  /**
   * Remove device token (on logout).
   */
  async removeDeviceToken(userId: string): Promise<void> {
    await this.metricsRepository.update(userId, { deviceToken: undefined });
  }

  /**
   * Send "It's a Match!" push to both users.
   */
  async sendMatchNotification(
    user1Id: string,
    user2Id: string,
    matchId: string,
  ): Promise<void> {
    const [profile1, profile2] = await Promise.all([
      this.profileRepository.findOne({ where: { userId: user1Id } }),
      this.profileRepository.findOne({ where: { userId: user2Id } }),
    ]);

    // Notify user1 about user2
    await this.sendToUser(user1Id, {
      type: NotificationType.NEW_MATCH,
      title: "It's a Match! 🎉",
      body: `You and ${profile2?.nickname ?? 'someone'} liked each other`,
      data: { matchId, userId: user2Id },
    });

    // Notify user2 about user1
    await this.sendToUser(user2Id, {
      type: NotificationType.NEW_MATCH,
      title: "It's a Match! 🎉",
      body: `You and ${profile1?.nickname ?? 'someone'} liked each other`,
      data: { matchId, userId: user1Id },
    });
  }

  /**
   * Send new message push to the recipient (if offline).
   */
  async sendMessageNotification(
    recipientId: string,
    senderId: string,
    matchId: string,
    messagePreview: string,
  ): Promise<void> {
    // Only push if recipient is offline
    const metrics = await this.metricsRepository.findOne({
      where: { userId: recipientId },
    });
    if (metrics?.isOnline) return; // They'll get it via WebSocket

    const senderProfile = await this.profileRepository.findOne({
      where: { userId: senderId },
    });

    const truncated =
      messagePreview.length > 50
        ? messagePreview.substring(0, 50) + '...'
        : messagePreview;

    await this.sendToUser(recipientId, {
      type: NotificationType.NEW_MESSAGE,
      title: senderProfile?.nickname ?? 'New message',
      body: truncated,
      data: { matchId, senderId },
    });
  }

  /**
   * Send "Someone liked you!" push (for premium: reveal who).
   */
  async sendLikeNotification(
    targetUserId: string,
    likerId: string,
  ): Promise<void> {
    const [targetMetrics, likerProfile] = await Promise.all([
      this.metricsRepository.findOne({ where: { userId: targetUserId } }),
      this.profileRepository.findOne({ where: { userId: likerId } }),
    ]);

    // Check if target is premium (to reveal who liked them)
    // We'd need to check users table, but for simplicity just send generic
    await this.sendToUser(targetUserId, {
      type: NotificationType.NEW_LIKE,
      title: 'Someone likes you! 👀',
      body: 'Open GayMeet to find out who',
      data: { likerId },
    });
  }

  /**
   * Core send method — looks up device token and sends via FCM.
   */
  private async sendToUser(
    userId: string,
    notification: {
      type: NotificationType;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<void> {
    const metrics = await this.metricsRepository.findOne({
      where: { userId },
    });

    if (!metrics?.deviceToken) {
      this.logger.debug(`No device token for user ${userId}, skipping push`);
      return;
    }

    if (!this.firebaseInitialized) {
      this.logger.debug(
        `[DRY RUN] Push to ${userId}: ${notification.title} — ${notification.body}`,
      );
      return;
    }

    try {
      await admin.messaging().send({
        token: metrics.deviceToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type,
          ...(notification.data ?? {}),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'gaymeet_default',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
      this.logger.debug(`Push sent to ${userId}: ${notification.title}`);
    } catch (err: any) {
      if (
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token'
      ) {
        // Token expired, clean it up
        await this.metricsRepository.update(userId, {
          deviceToken: undefined,
        });
        this.logger.warn(`Removed stale token for user ${userId}`);
      } else {
        this.logger.error(`Push failed for ${userId}:`, err.message);
      }
    }
  }
}
