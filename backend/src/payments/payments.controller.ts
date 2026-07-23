import {
  Controller, Post, Req, Headers, HttpCode, HttpStatus,
  BadRequestException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import { PaymentGateway } from '@prisma/client';
import { StripePaymentProvider } from '../payment/stripe.provider';
import { StripeSandboxPaymentProvider } from '../payment/stripe-sandbox.provider';
import { PaymentGatewayService } from '../payment/payment-gateways.service';
import { OrdersService } from '../orders/orders.service';

// Stripe webhook NESMIE byť rate-limitovaný – Stripe pri 429 retryuje a doručenie
// eventov by sa oneskorovalo/hromadilo. Skip pre celý controller (len webhook route).
@SkipThrottle()
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

    // Idempotency (krok 49, V2): najprv len ČÍTANIE – preskoč, ak už bol event plne
    // vybavený. Event sa označí ako spracovaný AŽ na konci (po úspešnom fulfille alebo
    // pri business chybe). Infra chyba vo fulfille prebublá bez označenia → Stripe retry
    // ho nájde ako nespracovaný a zopakuje.
    if (await this.ordersService.isStripeEventProcessed(event.id)) {
      this.logger.log(`Stripe event ${event.id} already processed – skipping`);
      return { received: true };
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (!orderId) {
        this.logger.warn(`checkout.session.completed without orderId metadata: ${session.id}`);
        // Nič na vybavenie – označ spracované, nech to Stripe zbytočne neretryuje.
        await this.ordersService.markStripeEventProcessed(event.id);
        return { received: true };
      }
      const paymentRef = (session.payment_intent as string) ?? session.id;
      try {
        await this.ordersService.fulfillOrder(orderId, 'stripe', paymentRef);
        // Best-effort: zachyť posledné 4 čísla karty (podklad pre budúce overenie identity).
        // Zlyhanie NIKDY nezhodí fulfillment – karta nemusí byť dostupná (napr. iný typ platby).
        await this.captureCardLast4(provider, orderId, session).catch((e) =>
          this.logger.warn(`captureCardLast4 skipped for ${orderId}: ${e.message}`),
        );
      } catch (err: any) {
        // Business chyba (už PAID/CANCELLED/neexistuje) = nič na retry. Optimistický
        // PENDING→PAID lock vo fulfillOrder tu vyhodí 400 „no longer pending" pri
        // duplicitnom doručení → fulfill prebehne PRÁVE RAZ (idempotencia drží).
        if (err.status === 400 || err.status === 403 || err.status === 404) {
          this.logger.warn(`fulfillOrder business error for ${orderId}: ${err.message} – marking processed`);
          await this.ordersService.markStripeEventProcessed(event.id);
          return { received: true };
        }
        // Infra chyba → NEoznačuj → Stripe retry to zopakuje (a napokon fulfillne).
        this.logger.error(`fulfillOrder infra error for ${orderId}: ${err.message} – NOT marking, Stripe will retry`);
        throw err;
      }
    }

    // Sem sa dostaneme len ak: fulfill uspel, alebo je to iný typ eventu, na ktorý
    // nereagujeme. V oboch prípadoch je event vybavený → označ spracovaný.
    await this.ordersService.markStripeEventProcessed(event.id);
    return { received: true };
  }

  /**
   * Dotiahne posledné 4 čísla karty zo Stripe: session → payment_intent →
   * latest_charge → payment_method_details.card.last4. Best-effort, tichý fail.
   */
  private async captureCardLast4(
    provider: { client: Stripe },
    orderId: string,
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const piId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!piId) return;
    const pi = await provider.client.paymentIntents.retrieve(piId, {
      expand: ['latest_charge'],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const last4 = charge?.payment_method_details?.card?.last4;
    if (last4) await this.ordersService.setCardLast4(orderId, last4);
  }
}
