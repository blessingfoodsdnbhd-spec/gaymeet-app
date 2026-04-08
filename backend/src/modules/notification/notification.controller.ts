import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { IsString } from 'class-validator';

class RegisterTokenDto {
  @IsString()
  token: string;
}

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * POST /api/notifications/token
   * Flutter app calls this on startup + token refresh
   */
  @Post('token')
  async registerToken(
    @CurrentUser() user: User,
    @Body() dto: RegisterTokenDto,
  ) {
    await this.notificationService.registerDeviceToken(user.id, dto.token);
    return { message: 'Device token registered' };
  }

  /**
   * DELETE /api/notifications/token
   * Called on logout
   */
  @Delete('token')
  async removeToken(@CurrentUser() user: User) {
    await this.notificationService.removeDeviceToken(user.id);
    return { message: 'Device token removed' };
  }
}
