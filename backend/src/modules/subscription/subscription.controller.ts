import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { IsString, IsIn, IsOptional } from 'class-validator';

class VerifyReceiptDto {
  @IsString()
  receipt: string;

  @IsString()
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsString()
  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  plan?: 'monthly' | 'yearly';
}

class PurchaseBoostDto {
  @IsString()
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';
}

@Controller('api/subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('status')
  async getStatus(@CurrentUser() user: User) {
    return this.subscriptionService.getStatus(user.id);
  }

  @Post('verify')
  async verifyReceipt(
    @CurrentUser() user: User,
    @Body() dto: VerifyReceiptDto,
  ) {
    return this.subscriptionService.verifyReceipt(
      user.id,
      dto.receipt,
      dto.platform,
      dto.plan,
    );
  }

  @Post('boost')
  async purchaseBoost(
    @CurrentUser() user: User,
    @Body() dto: PurchaseBoostDto,
  ) {
    return this.subscriptionService.purchaseBoost(user.id, dto.platform);
  }
}
