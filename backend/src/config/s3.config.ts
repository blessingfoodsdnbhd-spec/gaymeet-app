import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export const getS3Client = (configService: ConfigService): S3Client => {
  return new S3Client({
    region: configService.get<string>('AWS_REGION', 'us-east-1'),
    credentials: {
      accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
    },
  });
};
