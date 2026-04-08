import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { MatchService } from './match.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { SwipeDto } from './dto/swipe.dto';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post('swipes')
  async swipe(@CurrentUser() user: User, @Body() dto: SwipeDto) {
    return this.matchService.swipe(user.id, dto);
  }

  @Get('matches')
  async getMatches(@CurrentUser() user: User) {
    return this.matchService.getMatches(user.id);
  }

  @Delete('matches/:id')
  async unmatch(@CurrentUser() user: User, @Param('id') matchId: string) {
    return this.matchService.unmatch(user.id, matchId);
  }

  @Get('matches/likes')
  @UseGuards(PremiumGuard)
  async getLikes(@CurrentUser() user: User) {
    return this.matchService.getLikes(user.id);
  }
}
