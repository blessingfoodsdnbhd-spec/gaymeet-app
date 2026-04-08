import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';
import { UserProfile } from './user-profile.entity';
import { UserLocation } from './user-location.entity';
import { UserMetrics } from './user-metrics.entity';
import { UserPreferences } from './user-preferences.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProfile,
      UserLocation,
      UserMetrics,
      UserPreferences,
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
