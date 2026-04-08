import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  MinLength,
  Matches,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ClaimPlateDto {
  /**
   * Plate number — normalised to uppercase, spaces stripped.
   * Accepts 2–10 alphanumeric characters (covers MY, SG, AU formats).
   */
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'plateNumber must contain only letters and digits',
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.toUpperCase().replace(/\s+/g, '') : value,
  )
  plateNumber: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  carImageUrl?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.toUpperCase().replace(/\s+/g, '') : value,
  )
  plateNumber: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  content: string;
}

export class ReportMessageDto {
  @IsString()
  @IsIn([
    'inappropriate',
    'harassment',
    'spam',
    'fake',
    'other',
  ])
  reason: string;
}
