import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Message } from './message.entity';
import { Match } from '../match/match.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    private readonly dataSource: DataSource,
  ) {}

  async validateMatchAccess(matchId: string, userId: string): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });

    if (!match) throw new ForbiddenException('Match not found');

    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new ForbiddenException('Not your match');
    }

    return match;
  }

  async saveMessage(matchId: string, senderId: string, content: string) {
    const message = this.messageRepository.create({
      matchId,
      senderId,
      content,
    });
    return this.messageRepository.save(message);
  }

  async getMessages(matchId: string, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;

    // Raw query to join messages with user_profiles for sender nickname
    const messages = await this.dataSource.query(
      `
      SELECT
        msg.id,
        msg.content,
        msg."sender_id"  AS "senderId",
        p.nickname AS "senderNickname",
        msg."is_read"    AS "isRead",
        msg."created_at" AS "createdAt"
      FROM messages msg
      LEFT JOIN user_profiles p ON p."user_id" = msg."sender_id"
      WHERE msg."match_id" = $1
      ORDER BY msg."created_at" DESC
      LIMIT $2 OFFSET $3
      `,
      [matchId, limit, offset],
    );

    const countResult = await this.messageRepository.count({
      where: { matchId },
    });

    return {
      messages,
      total: countResult,
      page,
      pages: Math.ceil(countResult / limit),
    };
  }

  async markAsRead(matchId: string, userId: string) {
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('"match_id" = :matchId', { matchId })
      .andWhere('"sender_id" != :userId', { userId })
      .andWhere('"is_read" = false')
      .execute();
  }
}
