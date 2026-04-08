import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../user/user.entity';
import { UserProfile } from '../user/user-profile.entity';
import { UserLocation } from '../user/user-location.entity';
import { UserMetrics } from '../user/user-metrics.entity';
import { UserPreferences } from '../user/user-preferences.entity';
import { getJwtConfig } from '../../config/jwt.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, UserLocation, UserMetrics, UserPreferences]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getJwtConfig,
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
