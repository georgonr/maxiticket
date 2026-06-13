import { Module } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { OrganizerRefundsController, AdminRefundsController } from './refunds.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [OrganizerRefundsController, AdminRefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
