import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { InvoiceService } from './invoice.service';
import { BillingSchedulerService } from './billing-scheduler.service';
import { AdminBillingController } from './admin-billing.controller';
import { MailModule } from '../mail/mail.module';

// PrismaModule je @Global – netreba importovať explicitne.
@Module({
  imports: [MailModule],
  controllers: [AdminBillingController],
  providers: [BillingService, InvoiceService, BillingSchedulerService],
})
export class BillingModule {}
