import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicensePlate } from './entities/license-plate.entity';
import { PlateMessage } from './entities/plate-message.entity';
import { SawYouService } from './saw-you.service';
import { SawYouController } from './saw-you.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LicensePlate, PlateMessage])],
  controllers: [SawYouController],
  providers: [SawYouService],
})
export class SawYouModule {}
