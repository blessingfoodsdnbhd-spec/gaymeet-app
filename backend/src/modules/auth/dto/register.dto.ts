import { IsEmail, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nickname: string;
}

export class SocialLoginDto {
  @IsString()
  token: string;

  @IsString()
  @IsOptional()
  nickname?: string;
}
