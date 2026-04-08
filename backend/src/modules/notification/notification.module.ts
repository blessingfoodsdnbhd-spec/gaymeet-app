import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { UserMetrics } from '../user/user-metrics.entity';
import { UserProfile } from '../user/user-profile.entity';

@Global() // Global so MatchService and ChatGateway can inject it
@Module({
  imports: [TypeOrmModule.forFeature([UserMetrics, UserProfile])],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
