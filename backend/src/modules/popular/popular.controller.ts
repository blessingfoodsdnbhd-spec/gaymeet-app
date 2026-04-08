import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { PopularService } from './popular.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';

class UseTicketDto {
  @IsString()
  @Length(2, 2)
  countryCode: string;
}

@Controller('api/popular')
@UseGuards(JwtAuthGuard)
export class PopularController {
  constructor(private readonly popularService: PopularService) {}

  /** Today's popular users for a given country */
  @Get()
  getPopular(@Query('countryCode') countryCode: string = 'MY') {
    return this.popularService.getPopular(countryCode);
  }

  /** Use a popularity ticket to feature yourself */
  @Post('ticket/use')
  useTicket(@CurrentUser() user: User, @Body() dto: UseTicketDto) {
    return this.popularService.useTicket(user.id, dto.countryCode);
  }

  /** Purchase a popularity ticket (mock) */
  @Post('ticket/purchase')
  purchaseTicket(@CurrentUser() user: User) {
    return this.popularService.purchaseTicket(user.id);
  }

  /** Internal: refresh daily popular snapshot (should be protected in production) */
  @Post('refresh')
  refreshDaily() {
    return this.popularService.refreshDailyPopular();
  }
}
