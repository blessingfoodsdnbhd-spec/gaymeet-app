import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shout } from './entities/shout.entity';
import { ShoutService } from './shout.service';
import { ShoutController } from './shout.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Shout])],
  controllers: [ShoutController],
  providers: [ShoutService],
})
export class ShoutModule {}
