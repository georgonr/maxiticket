import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from './payment.interface';
import { MockPaymentProvider } from './mock.provider';
import { StripePaymentProvider } from './stripe.provider';
import { StripeSandboxPaymentProvider } from './stripe-sandbox.provider';
import { ComGatePaymentProvider } from './comgate.provider';
import { PaymentGatewayService } from './payment-gateways.service';
import { PaymentGatewaysController } from './payment-gateways.controller';

@Module({
  imports: [ConfigModule],
  controllers: [PaymentGatewaysController],
  providers: [
    StripePaymentProvider,
    MockPaymentProvider,
    StripeSandboxPaymentProvider,
    ComGatePaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: ConfigService, stripe: StripePaymentProvider, mock: MockPaymentProvider) => {
        return config.get('PAYMENT_PROVIDER', 'mock') === 'stripe' ? stripe : mock;
      },
      inject: [ConfigService, StripePaymentProvider, MockPaymentProvider],
    },
    PaymentGatewayService,
  ],
  exports: [PAYMENT_PROVIDER, StripePaymentProvider, PaymentGatewayService],
})
export class PaymentModule {}
