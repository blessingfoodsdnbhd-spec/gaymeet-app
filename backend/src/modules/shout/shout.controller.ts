import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ShoutService } from './shout.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';

class PostShoutDto {
  @IsString()
  @MaxLength(200)
  content: string;

  @IsNumber()
  @Min(-90) @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180) @Max(180)
  longitude: number;
}

class NearbyShoutQueryDto {
  @IsNumber()
  @Min(-90) @Max(90)
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @Min(-180) @Max(180)
  @Type(() => Number)
  longitude: number;

  @IsNumber()
  @Min(1) @Max(100)
  @Type(() => Number)
  radius?: number = 50;
}

@Controller('api/shouts')
@UseGuards(JwtAuthGuard)
export class ShoutController {
  constructor(private readonly shoutService: ShoutService) {}

  /** Post (or replace) the current user's shout */
  @Post()
  postShout(@CurrentUser() user: User, @Body() dto: PostShoutDto) {
    return this.shoutService.postShout(
      user.id,
      dto.content,
      dto.latitude,
      dto.longitude,
    );
  }

  /** Get nearby active shouts */
  @Get()
  getNearbyShouts(
    @CurrentUser() user: User,
    @Query() query: NearbyShoutQueryDto,
  ) {
    return this.shoutService.getNearbyShouts(
      user.id,
      query.latitude,
      query.longitude,
      query.radius,
    );
  }

  /** Get the current user's own active shout */
  @Get('mine')
  getMyShout(@CurrentUser() user: User) {
    return this.shoutService.getMyShout(user.id);
  }

  /** Delete (retract) the current user's shout */
  @Delete()
  deleteShout(@CurrentUser() user: User) {
    return this.shoutService.deleteShout(user.id);
  }
}
