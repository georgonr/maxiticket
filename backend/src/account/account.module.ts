import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { OrdersModule } from '../orders/orders.module';
import { RefundsModule } from '../refunds/refunds.module';

@Module({
  imports: [OrdersModule, RefundsModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
