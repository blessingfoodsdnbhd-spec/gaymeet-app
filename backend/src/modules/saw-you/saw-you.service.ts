import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { LicensePlate } from './entities/license-plate.entity';
import { PlateMessage } from './entities/plate-message.entity';
import { ClaimPlateDto, SendMessageDto, ReportMessageDto } from './dto/saw-you.dto';
import { containsProfanity } from './profanity-filter';

/** Free users can send at most this many plate messages per day */
const FREE_DAILY_LIMIT = 3;

/** Free users see only this many characters of a message */
const FREE_PREVIEW_LENGTH = 20;

@Injectable()
export class SawYouService {
  constructor(
    @InjectRepository(LicensePlate)
    private readonly plateRepo: Repository<LicensePlate>,

    @InjectRepository(PlateMessage)
    private readonly messageRepo: Repository<PlateMessage>,

    private readonly dataSource: DataSource,
  ) {}

  // ── Claim a plate ─────────────────────────────────────────────────────────

  async claimPlate(userId: string, dto: ClaimPlateDto) {
    const { plateNumber, carImageUrl } = dto;

    // Check if already claimed by a DIFFERENT user
    const existing = await this.plateRepo.findOne({
      where: { plateNumber },
    });

    if (existing && existing.userId && existing.userId !== userId) {
      throw new ConflictException('This plate has already been claimed');
    }

    if (existing) {
      // Update existing record (re-claim after transfer, or update car photo)
      await this.plateRepo.update(existing.id, {
        userId,
        carImageUrl: carImageUrl ?? existing.carImageUrl,
      });
      return this.plateRepo.findOne({ where: { id: existing.id } });
    }

    // First time this plate appears in the system
    const plate = this.plateRepo.create({
      plateNumber,
      userId,
      carImageUrl: carImageUrl ?? null,
    });
    return this.plateRepo.save(plate);
  }

  // ── Send an anonymous message to a plate ──────────────────────────────────

  async sendMessage(
    senderId: string,
    isPremium: boolean,
    dto: SendMessageDto,
  ) {
    const { plateNumber, content } = dto;

    // Server-side profanity check
    if (containsProfanity(content)) {
      throw new BadRequestException(
        'Message contains prohibited content. Please revise and try again.',
      );
    }

    // Daily rate limit for free users
    if (!isPremium) {
      const todayCount = await this.dataSource.query<{ count: string }[]>(
        `
        SELECT COUNT(*)::int AS count
        FROM plate_messages
        WHERE sender_id = $1
          AND created_at >= CURRENT_DATE
          AND created_at <  CURRENT_DATE + INTERVAL '1 day'
        `,
        [senderId],
      );
      const count = Number(todayCount[0]?.count ?? 0);
      if (count >= FREE_DAILY_LIMIT) {
        throw new ForbiddenException(
          `Free users can send at most ${FREE_DAILY_LIMIT} plate messages per day. Upgrade to Premium for unlimited messaging.`,
        );
      }
    }

    // Create the message
    const message = this.messageRepo.create({
      plateNumber,
      senderId,
      content,
    });
    const saved = await this.messageRepo.save(message);

    // TODO: FCM push notification
    // If the plate is claimed, look up the owner and send:
    //   notificationService.send(ownerId, {
    //     title: 'Someone saw you! 👀',
    //     body: 'You have a new anonymous message on your plate.',
    //     data: { type: 'plate_message' },
    //   });

    return { id: saved.id, createdAt: saved.createdAt };
  }

  // ── Get inbox for claimed plate ───────────────────────────────────────────

  async getMessages(userId: string, isPremium: boolean) {
    // Find user's claimed plate
    const plate = await this.plateRepo.findOne({ where: { userId } });
    if (!plate) {
      return { plateNumber: null, messages: [] };
    }

    const messages = await this.messageRepo.find({
      where: {
        plateNumber: plate.plateNumber,
        isBlocked: false,
      },
      order: { createdAt: 'DESC' },
    });

    // Mark unread messages as read
    const unreadIds = messages
      .filter((m) => !m.isRead)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await this.dataSource.query(
        `UPDATE plate_messages SET is_read = true WHERE id = ANY($1::uuid[])`,
        [unreadIds],
      );
    }

    return {
      plateNumber: plate.plateNumber,
      carImageUrl: plate.carImageUrl,
      messages: messages.map((m) => this.formatMessage(m, isPremium)),
    };
  }

  // ── Check if a plate exists ───────────────────────────────────────────────

  async checkPlate(plateNumber: string) {
    const normalised = plateNumber.toUpperCase().replace(/\s+/g, '');

    const [plate, messageCount] = await Promise.all([
      this.plateRepo.findOne({ where: { plateNumber: normalised } }),
      this.messageRepo.count({ where: { plateNumber: normalised, isBlocked: false } }),
    ]);

    return {
      exists: !!plate,
      isClaimed: !!(plate?.userId),
      messageCount,
    };
  }

  // ── Report a message ──────────────────────────────────────────────────────

  async reportMessage(userId: string, messageId: string, dto: ReportMessageDto) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');

    // Verify the reporting user owns the target plate
    const plate = await this.plateRepo.findOne({
      where: { plateNumber: message.plateNumber, userId },
    });
    if (!plate) throw new ForbiddenException('You cannot report this message');

    await this.messageRepo.update(messageId, { isReported: true });

    // TODO: emit report event to admin dashboard or moderation queue

    return { success: true };
  }

  // ── Block a message sender ────────────────────────────────────────────────

  async blockSender(userId: string, messageId: string) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');

    // Verify the blocking user owns the target plate
    const plate = await this.plateRepo.findOne({
      where: { plateNumber: message.plateNumber, userId },
    });
    if (!plate) throw new ForbiddenException('You cannot block this sender');

    // Hide all messages from this sender on this plate
    await this.dataSource.query(
      `
      UPDATE plate_messages
      SET is_blocked = true
      WHERE plate_number = $1 AND sender_id = $2
      `,
      [message.plateNumber, message.senderId],
    );

    return { success: true };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formatMessage(message: PlateMessage, isPremium: boolean) {
    const content = isPremium
      ? message.content
      : message.content.length > FREE_PREVIEW_LENGTH
        ? message.content.substring(0, FREE_PREVIEW_LENGTH) + '...'
        : message.content;

    return {
      id: message.id,
      content,
      isFullContent: isPremium || message.content.length <= FREE_PREVIEW_LENGTH,
      isRead: message.isRead,
      isReported: message.isReported,
      createdAt: message.createdAt,
    };
  }
}
