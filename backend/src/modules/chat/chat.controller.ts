import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';

@Controller('api/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':matchId/messages')
  async getMessages(
    @CurrentUser() user: User,
    @Param('matchId') matchId: string,
    @Query('page') page: number = 1,
  ) {
    await this.chatService.validateMatchAccess(matchId, user.id);
    return this.chatService.getMessages(matchId, page);
  }
}
