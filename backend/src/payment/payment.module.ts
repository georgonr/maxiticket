import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from './payment.interface';
import { MockPaymentProvider } from './mock.provider';
import { StripePaymentProvider } from './stripe.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    StripePaymentProvider,
    MockPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: ConfigService, stripe: StripePaymentProvider, mock: MockPaymentProvider) => {
        return config.get('PAYMENT_PROVIDER', 'mock') === 'stripe' ? stripe : mock;
      },
      inject: [ConfigService, StripePaymentProvider, MockPaymentProvider],
    },
  ],
  exports: [PAYMENT_PROVIDER, StripePaymentProvider],
})
export class PaymentModule {}
