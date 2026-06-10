import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { MailModule } from '../mail/mail.module';

// PrismaModule je @Global – netreba importovať.
@Module({
  imports: [MailModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
