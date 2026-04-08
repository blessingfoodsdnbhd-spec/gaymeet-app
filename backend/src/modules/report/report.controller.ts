import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';

class CreateReportDto {
  reportedId: string;
  reason: string;
  description?: string;
}

class BlockUserDto {
  blockedId: string;
}

@Controller('api')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('reports')
  async reportUser(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.reportService.reportUser(
      user.id,
      dto.reportedId,
      dto.reason,
      dto.description,
    );
  }

  @Post('blocks')
  async blockUser(@CurrentUser() user: User, @Body() dto: BlockUserDto) {
    return this.reportService.blockUser(user.id, dto.blockedId);
  }

  @Delete('blocks/:userId')
  async unblockUser(@CurrentUser() user: User, @Param('userId') blockedId: string) {
    return this.reportService.unblockUser(user.id, blockedId);
  }
}
