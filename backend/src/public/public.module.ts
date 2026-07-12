import { Module } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import { MailModule } from '../mail/mail.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [MailModule, OrdersModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
