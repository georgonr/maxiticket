import { Module } from '@nestjs/common';
import { HeroBannersService } from './hero-banners.service';
import { HeroBannersController, AdminShowsController } from './hero-banners.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [HeroBannersController, AdminShowsController],
  providers: [HeroBannersService],
})
export class HeroBannersModule {}
