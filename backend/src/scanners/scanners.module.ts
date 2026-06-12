import { Module } from '@nestjs/common';
import { ScannersController } from './scanners.controller';
import { ScannersService } from './scanners.service';

@Module({
  controllers: [ScannersController],
  providers: [ScannersService],
})
export class ScannersModule {}
