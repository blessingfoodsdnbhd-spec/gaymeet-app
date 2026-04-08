import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { Swipe } from './swipe.entity';
import { Match } from './match.entity';
import { User } from '../user/user.entity';
import { UserProfile } from '../user/user-profile.entity';
import { UserMetrics } from '../user/user-metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Swipe, Match, User, UserProfile, UserMetrics])],
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
