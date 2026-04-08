import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { MatchModule } from './modules/match/match.module';
import { ChatModule } from './modules/chat/chat.module';
import { ReportModule } from './modules/report/report.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ShoutModule } from './modules/shout/shout.module';
import { PopularModule } from './modules/popular/popular.module';
import { SawYouModule } from './modules/saw-you/saw-you.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    AuthModule,
    UserModule,
    MatchModule,
    ChatModule,
    ReportModule,
    SubscriptionModule,
    NotificationModule,
    ShoutModule,
    PopularModule,
    SawYouModule,
  ],
})
export class AppModule {}
