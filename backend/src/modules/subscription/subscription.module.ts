import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { User } from '../user/user.entity';
import { Subscription } from './subscription.entity';
import { Transaction } from './transaction.entity';
import { Boost } from './boost.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Subscription, Transaction, Boost])],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
