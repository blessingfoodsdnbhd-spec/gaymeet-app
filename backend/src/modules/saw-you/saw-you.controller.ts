import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SawYouService } from './saw-you.service';
import { ClaimPlateDto, SendMessageDto, ReportMessageDto } from './dto/saw-you.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';

@Controller('api/plates')
@UseGuards(JwtAuthGuard)
export class SawYouController {
  constructor(private readonly sawYouService: SawYouService) {}

  /** Claim a license plate as your own */
  @Post('claim')
  claimPlate(@CurrentUser() user: User, @Body() dto: ClaimPlateDto) {
    return this.sawYouService.claimPlate(user.id, dto);
  }

  /** Send an anonymous message to a plate number */
  @Post('message')
  sendMessage(@CurrentUser() user: User, @Body() dto: SendMessageDto) {
    return this.sawYouService.sendMessage(user.id, user.isPremium, dto);
  }

  /** Get the inbox for the current user's claimed plate */
  @Get('messages')
  getMessages(@CurrentUser() user: User) {
    return this.sawYouService.getMessages(user.id, user.isPremium);
  }

  /** Check whether a plate exists and how many messages it has */
  @Get('check/:plate')
  checkPlate(@Param('plate') plate: string) {
    return this.sawYouService.checkPlate(plate);
  }

  /** Report a message (by the plate owner) */
  @Post('messages/:id/report')
  reportMessage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ReportMessageDto,
  ) {
    return this.sawYouService.reportMessage(user.id, id, dto);
  }

  /** Block the sender of a message (by the plate owner) */
  @Post('messages/:id/block')
  blockSender(@CurrentUser() user: User, @Param('id') id: string) {
    return this.sawYouService.blockSender(user.id, id);
  }
}
