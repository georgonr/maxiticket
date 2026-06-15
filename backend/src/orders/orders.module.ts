import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersQueryService } from './orders-query.service';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrganizerOrdersController } from './organizer-orders.controller';
import { PosController } from './pos.controller';
import { RefundExportController } from './refund-export.controller';
import { RefundExportService } from './refund-export.service';
import { MailModule } from '../mail/mail.module';
import { PaymentModule } from '../payment/payment.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [MailModule, PaymentModule, CouponsModule],
  controllers: [OrdersController, AdminOrdersController, OrganizerOrdersController, PosController, RefundExportController],
  providers: [OrdersService, OrdersQueryService, RefundExportService],
  exports: [OrdersService, OrdersQueryService],
})
export class OrdersModule {}
