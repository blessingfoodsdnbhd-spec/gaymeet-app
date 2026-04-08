import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  nickname?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsDateString()
  @IsOptional()
  birthday?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class UpdateLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

export class UpdatePreferencesDto {
  @IsNumber()
  @IsOptional()
  @Min(18)
  @Max(99)
  ageMin?: number;

  @IsNumber()
  @IsOptional()
  @Min(18)
  @Max(99)
  ageMax?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  distanceMaxKm?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagsPreference?: string[];

  @IsBoolean()
  @IsOptional()
  showOnlineOnly?: boolean;

  @IsBoolean()
  @IsOptional()
  hideDistance?: boolean;
}

export class NearbyQueryDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  radius?: number = 10; // km

  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
