import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentModule } from '../payment/payment.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [PaymentModule, OrdersModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
