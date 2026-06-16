import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { AdminBillingController } from './admin-billing.controller';

// PrismaModule je @Global – netreba importovať explicitne.
@Module({
  controllers: [AdminBillingController],
  providers: [BillingService],
})
export class BillingModule {}
