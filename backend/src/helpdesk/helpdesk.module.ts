import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from '../telegram/telegram.module';
import { HelpdeskNumberService } from './helpdesk-number.service';
import { HelpdeskMailService } from './helpdesk-mail.service';
import { HelpdeskService } from './helpdesk.service';
import { HelpdeskController } from './helpdesk.controller';
import { MailModule } from '../mail/mail.module';
import { CaslModule } from '../casl/casl.module';

/**
 * Helpdesk (kroky 28–31): číslovanie, IMAP poller, admin API.
 * PrismaModule je @Global, netreba ho importovať.
 */
@Module({
  imports: [ConfigModule, TelegramModule, MailModule, CaslModule],
  controllers: [HelpdeskController],
  providers: [HelpdeskNumberService, HelpdeskMailService, HelpdeskService],
  exports: [HelpdeskNumberService, HelpdeskMailService, HelpdeskService],
})
export class HelpdeskModule {}
