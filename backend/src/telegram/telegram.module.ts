import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [ConfigModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService], // pre krok 3 (cron/summary notifikácie)
})
export class TelegramModule {}
