import { Module } from '@nestjs/common';
import { ShowImagesController } from './show-images.controller';
import { ShowImagesService } from './show-images.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ShowImagesController],
  providers: [ShowImagesService],
})
export class ShowImagesModule {}
