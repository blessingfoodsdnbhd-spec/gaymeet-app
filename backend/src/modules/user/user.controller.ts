import {
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './user.entity';
import {
  UpdateProfileDto,
  UpdateLocationDto,
  UpdatePreferencesDto,
  NearbyQueryDto,
} from './dto/update-profile.dto';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMyProfile(@CurrentUser() user: User) {
    return this.userService.getProfile(user.id);
  }

  @Patch('me')
  async updateMyProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, dto);
  }

  @Put('me/location')
  async updateLocation(
    @CurrentUser() user: User,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.userService.updateLocation(user.id, dto);
  }

  @Patch('me/preferences')
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.userService.updatePreferences(user.id, dto);
  }

  @Post('me/avatar')
  async getAvatarUploadUrl(@CurrentUser() user: User) {
    return this.userService.getAvatarUploadUrl(user.id);
  }

  @Get('nearby')
  async getNearbyUsers(
    @CurrentUser() user: User,
    @Query() query: NearbyQueryDto,
  ) {
    return this.userService.getNearbyUsers(
      user.id,
      query.radius,
      query.page,
      query.limit,
    );
  }

  // ── Teleport / Stealth ─────────────────────────────────────────────────────

  /** Set a virtual (fake) location — premium feature */
  @Post('me/teleport')
  async setVirtualLocation(
    @CurrentUser() user: User,
    @Body() dto: TeleportDto,
  ) {
    return this.userService.setVirtualLocation(user.id, dto);
  }

  /** Clear the virtual location (revert to real GPS) */
  @Delete('me/teleport')
  async clearVirtualLocation(@CurrentUser() user: User) {
    return this.userService.clearVirtualLocation(user.id);
  }

  /** Toggle stealth mode */
  @Patch('me/stealth')
  async setStealthMode(
    @CurrentUser() user: User,
    @Body() dto: StealthDto,
  ) {
    return this.userService.setStealthMode(user.id, dto.enabled);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string, @CurrentUser() user: User) {
    return this.userService.getUserById(id, user.id);
  }
}

// ── Inline DTOs for location features ────────────────────────────────────────

class TeleportDto {
  @IsNumber() @Min(-90) @Max(90)   latitude: number;
  @IsNumber() @Min(-180) @Max(180) longitude: number;
  @IsOptional() @IsString() @MaxLength(200) label?: string;
}

class StealthDto {
  @IsBoolean() enabled: boolean;
}
