import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './report.entity';
import { Block } from './block.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Block)
    private readonly blockRepository: Repository<Block>,
  ) {}

  async reportUser(
    reporterId: string,
    reportedId: string,
    reason: string,
    description?: string,
  ) {
    if (reporterId === reportedId) {
      throw new BadRequestException('Cannot report yourself');
    }

    const report = this.reportRepository.create({
      reporterId,
      reportedId,
      reason,
      description,
    });

    return this.reportRepository.save(report);
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const existing = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (existing) {
      throw new ConflictException('User already blocked');
    }

    const block = this.blockRepository.create({ blockerId, blockedId });
    return this.blockRepository.save(block);
  }

  async unblockUser(blockerId: string, blockedId: string) {
    const block = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (!block) {
      throw new BadRequestException('User not blocked');
    }

    await this.blockRepository.remove(block);
    return { message: 'User unblocked' };
  }

  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const block = await this.blockRepository.findOne({
      where: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    });
    return !!block;
  }
}
