import { Module } from '@nestjs/common';
import { PopularService } from './popular.service';
import { PopularController } from './popular.controller';

@Module({
  controllers: [PopularController],
  providers: [PopularService],
})
export class PopularModule {}
