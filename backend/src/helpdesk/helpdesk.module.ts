import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from '../telegram/telegram.module';
import { HelpdeskNumberService } from './helpdesk-number.service';
import { HelpdeskMailService } from './helpdesk-mail.service';

/**
 * Helpdesk (kroky 28–29). Zatiaľ bez controllerov – admin UI a endpointy
 * prídu neskôr. PrismaModule je @Global, netreba ho importovať.
 */
@Module({
  imports: [ConfigModule, TelegramModule],
  providers: [HelpdeskNumberService, HelpdeskMailService],
  exports: [HelpdeskNumberService, HelpdeskMailService],
})
export class HelpdeskModule {}
