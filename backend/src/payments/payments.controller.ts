import {
  Controller, Post, Req, Headers, HttpCode, HttpStatus,
  BadRequestException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import { PaymentGateway } from '@prisma/client';
import { StripePaymentProvider } from '../payment/stripe.provider';
import { StripeSandboxPaymentProvider } from '../payment/stripe-sandbox.provider';
import { PaymentGatewayService } from '../payment/payment-gateways.service';
import { OrdersService } from '../orders/orders.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private config: ConfigService,
    private stripeProvider: StripePaymentProvider,
    private stripeSandbox: StripeSandboxPaymentProvider,
    private gateways: PaymentGatewayService,
    private ordersService: OrdersService,
  ) {}

  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: FastifyRequest & { rawBody?: string },
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw body');
    if (!signature) throw new BadRequestException('Missing stripe-signature header');

    // Gateway-aware: overuj podpis secretom podľa AKTÍVNEJ brány (live vs sandbox).
    const gateway = await this.gateways.getActiveGateway();
    const sandbox = gateway === PaymentGateway.STRIPE_SANDBOX;
    const provider = sandbox ? this.stripeSandbox : this.stripeProvider;
    const webhookSecret = provider.webhookSecret;
    if (!webhookSecret) {
      const envName = sandbox ? 'STRIPE_WEBHOOK_SECRET_TEST' : 'STRIPE_WEBHOOK_SECRET';
      this.logger.error(`[STRIPE webhook] Aktívna brána ${gateway}, ale ${envName} nie je nastavený – podpis sa nedá overiť, objednávka sa NEfulfillne. Doplňte ${envName} do .env.`);
      return { received: true };
    }

    let event: Stripe.Event;
    try {
      event = provider.client.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.warn(`Stripe signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook signature invalid: ${err.message}`);
    }

    // Idempotency: skip already-processed events
    const alreadyProcessed = await this.ordersService.recordStripeEvent(event.id);
    if (alreadyProcessed) {
      this.logger.log(`Stripe event ${event.id} already processed – skipping`);
      return { received: true };
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (!orderId) {
        this.logger.warn(`checkout.session.completed without orderId metadata: ${session.id}`);
        return { received: true };
      }
      const paymentRef = (session.payment_intent as string) ?? session.id;
      try {
        await this.ordersService.fulfillOrder(orderId, 'stripe', paymentRef);
      } catch (err: any) {
        this.logger.error(`fulfillOrder failed for ${orderId}: ${err.message}`);
        // Return 200 to avoid Stripe retrying for business-logic errors (already paid / cancelled)
        // For real infrastructure errors, let them propagate so Stripe retries
        if (err.status === 400 || err.status === 403 || err.status === 404) {
          return { received: true };
        }
        throw err;
      }
    }

    return { received: true };
  }
}
