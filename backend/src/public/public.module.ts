import { Module } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import { MailModule } from '../mail/mail.module';
import { OrdersModule } from '../orders/orders.module';
import { PlatformInfoModule } from '../platform-info/platform-info.module';

@Module({
  imports: [MailModule, OrdersModule, PlatformInfoModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
