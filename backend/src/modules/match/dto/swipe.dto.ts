import { IsString, IsIn, IsUUID } from 'class-validator';

export class SwipeDto {
  @IsUUID()
  targetUserId: string;

  @IsString()
  @IsIn(['like', 'pass'])
  direction: 'like' | 'pass';
}
