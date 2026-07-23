import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Inject, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { MailService } from '../mail/mail.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CompOrderDto } from './dto/comp-order.dto';
import { PosOrderDto } from './dto/pos-order.dto';
import { Prisma, OrderStatus, TerminStatus, TicketStatus, UserRole, TerminMode, SectionMode, SeatStatus, TermsType } from '@prisma/client';
import { createHmac, randomUUID } from 'crypto';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payment/payment.interface';
import { PaymentGatewayService } from '../payment/payment-gateways.service';
import { sendTicketsForOrder } from './orders-mail.helper';
import { signGuestTicketToken, guestTicketSecret } from './guest-ticket-token';
import { codedBadRequest, codedNotFound, codedConflict } from '../common/errors/coded-exception';
import { CouponsService } from '../coupons/coupons.service';
import { EkasaService } from '../ekasa/ekasa.service';
import { generatePosClosurePdf, PosClosureByTermin } from './pos-closure-pdf.helper';

// Krok 2/2: názov riadku poplatku na Stripe (podľa jazyka objednávky). Sumu vidí
// zákazník; %-konfig organizátora NIE.
const FEE_LABEL: Record<string, string> = {
  sk: 'Poplatok za spracovanie',
  en: 'Processing fee',
  cs: 'Poplatek za zpracování',
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mail: MailService,
    private coupons: CouponsService,
    @Inject(PAYMENT_PROVIDER) private paymentProvider: PaymentProvider,
    private gateways: PaymentGatewayService,
    private ekasa: EkasaService,
  ) {}

  async createOrder(dto: CreateOrderDto, user?: JwtPayload, ipAddress?: string, userAgent?: string) {
    const termin = await this.prisma.termin.findUnique({
      where: { id: dto.terminId },
      include: {
        show: true,
        venue: true,
        ticketTypes: true,
        terminSections: { include: { section: true } },
      },
    });
    if (!termin) throw codedNotFound('TERMIN_NOT_FOUND', 'Termin not found');
    if (termin.status !== TerminStatus.ON_SALE) {
      throw codedBadRequest('EVENT_NOT_AVAILABLE', 'This event is not available for purchase');
    }

    let totalAmount = 0;
    let currency = 'EUR';
    // Pripravené položky: data pre OrderItem + (pre SEATED) zoznam sedadiel na atomický claim.
    const preparedItems: { data: Prisma.OrderItemCreateWithoutOrderInput; seatIds?: string[] }[] = [];

    if (termin.mode === TerminMode.SEATMAP) {
      for (const item of dto.items) {
        if (!item.terminSectionId) {
          throw codedBadRequest('SECTION_REQUIRED', 'Pre tento termín musíte vybrať sekciu (terminSectionId).');
        }
        const ts = termin.terminSections.find((t) => t.id === item.terminSectionId);
        if (!ts) throw codedNotFound('SECTION_NOT_FOUND', `Sekcia ${item.terminSectionId} pre tento termín neexistuje.`, { section: item.terminSectionId });

        if (ts.section.mode === SectionMode.SEATED) {
          // Úloha 22/3b: SEATED predaj konkrétnych sedadiel. Claim sa vykoná atomicky pri zápise.
          const seatIds = [...new Set(item.seatIds ?? [])];
          if (seatIds.length === 0) {
            throw codedBadRequest('SEAT_REQUIRED', `Sekcia "${ts.section.name}": vyberte aspoň jedno sedadlo.`, { section: ts.section.name });
          }
          // Over že sedadlá patria tejto sekcii termínu (existencia AVAILABLE sa overí pri claime).
          const terminSeats = await this.prisma.terminSeat.findMany({
            where: { terminId: termin.id, seatId: { in: seatIds } },
            include: { seat: { include: { row: true } } },
          });
          if (terminSeats.length !== seatIds.length) {
            throw codedBadRequest('SEATS_INVALID', 'Niektoré zvolené sedadlá pre tento termín neexistujú.');
          }
          for (const tseat of terminSeats) {
            if (tseat.seat.row.sectionId !== ts.sectionId) {
              throw codedBadRequest('SEAT_WRONG_SECTION', `Sedadlo "${tseat.seat.label}" nepatrí sekcii "${ts.section.name}".`, { seat: tseat.seat.label, section: ts.section.name });
            }
          }

          const qty = seatIds.length;
          totalAmount += Number(ts.price) * qty;
          currency = ts.currency;
          preparedItems.push({
            data: {
              terminSection: { connect: { id: ts.id } },
              termin: { connect: { id: termin.id } },
              quantity: qty,
              unitPrice: ts.price,
              currency: ts.currency,
              priceSnapshot: {
                name: ts.section.name,
                price: Number(ts.price),
                currency: ts.currency,
                showName: termin.show.name,
                terminId: termin.id,
                startsAt: termin.startsAt,
                sectionId: ts.sectionId,
                seated: true,
                seats: terminSeats.map((t) => ({ id: t.seatId, label: t.seat.label, row: t.seat.row.label })),
              },
            },
            seatIds,
          });
          continue;
        }

        // SECTIONED (úloha 22/3a) – množstvo vs kapacita, PENDING aj PAID rezervujú (ako GENERAL).
        if (!item.quantity || item.quantity < 1) {
          throw codedBadRequest('SECTION_QTY_REQUIRED', `Sekcia "${ts.section.name}": zadajte počet.`, { section: ts.section.name });
        }
        if (ts.section.capacity != null) {
          const sold = await this.prisma.orderItem.aggregate({
            where: {
              terminSectionId: ts.id,
              order: { status: { in: [OrderStatus.PENDING, OrderStatus.PAID] } },
            },
            _sum: { quantity: true },
          });
          const remaining = ts.section.capacity - (sold._sum.quantity ?? 0);
          if (remaining < item.quantity) {
            throw codedBadRequest('SECTION_INSUFFICIENT', `Sekcia "${ts.section.name}": zostáva len ${remaining} ks.`, { section: ts.section.name, remaining });
          }
        }

        totalAmount += Number(ts.price) * item.quantity;
        currency = ts.currency;
        preparedItems.push({
          data: {
            terminSection: { connect: { id: ts.id } },
            termin: { connect: { id: termin.id } },
            quantity: item.quantity,
            unitPrice: ts.price,
            currency: ts.currency,
            priceSnapshot: {
              name: ts.section.name,
              price: Number(ts.price),
              currency: ts.currency,
              showName: termin.show.name,
              terminId: termin.id,
              startsAt: termin.startsAt,
              sectionId: ts.sectionId,
            },
          },
        });
      }
    } else {
      for (const item of dto.items) {
        const tt = termin.ticketTypes.find((t) => t.id === item.ticketTypeId);
        if (!tt) throw codedNotFound('TICKET_TYPE_NOT_FOUND', `TicketType ${item.ticketTypeId} not found`, { ticketType: item.ticketTypeId ?? '' });
        if (!tt.isActive) throw codedBadRequest('TICKET_TYPE_INACTIVE', `Ticket type ${tt.name} is not active`, { name: tt.name });
        if (!item.quantity || item.quantity < 1) {
          throw codedBadRequest('TICKET_QTY_REQUIRED', `Zadajte počet pre "${tt.name}".`, { name: tt.name });
        }
        if (item.quantity > tt.maxPerOrder) {
          throw codedBadRequest('MAX_PER_ORDER', `Max ${tt.maxPerOrder} tickets of type "${tt.name}" per order`, { max: tt.maxPerOrder, name: tt.name });
        }

        const now = new Date();
        if (tt.saleStartsAt && now < tt.saleStartsAt) {
          throw codedBadRequest('SALE_NOT_STARTED', `Sale for "${tt.name}" has not started yet`, { name: tt.name });
        }
        if (tt.saleEndsAt && now > tt.saleEndsAt) {
          throw codedBadRequest('SALE_ENDED', `Sale for "${tt.name}" has ended`, { name: tt.name });
        }

        // Availability check – PENDING orders also reserve capacity
        if (tt.totalQuantity != null) {
          const sold = await this.prisma.orderItem.aggregate({
            where: {
              ticketTypeId: tt.id,
              order: { status: { in: [OrderStatus.PENDING, OrderStatus.PAID] } },
            },
            _sum: { quantity: true },
          });
          const remaining = tt.totalQuantity - (sold._sum.quantity ?? 0);
          if (remaining < item.quantity) {
            throw codedBadRequest('TICKET_INSUFFICIENT', `Only ${remaining} ticket(s) of type "${tt.name}" remaining`, { remaining, name: tt.name });
          }
        }

        totalAmount += Number(tt.price) * item.quantity;
        currency = tt.currency;
        preparedItems.push({
          data: {
            ticketType: { connect: { id: tt.id } },
            termin: { connect: { id: termin.id } },
            quantity: item.quantity,
            unitPrice: tt.price,
            currency: tt.currency,
            priceSnapshot: {
              name: tt.name,
              price: Number(tt.price),
              currency: tt.currency,
              showName: termin.show.name,
              terminId: termin.id,
              startsAt: termin.startsAt,
            },
          },
        });
      }
    }

    if (preparedItems.length === 0) {
      throw codedBadRequest('ORDER_EMPTY', 'Objednávka neobsahuje žiadne položky.');
    }

    // Guest checkout: bez prihlásenia musí DTO obsahovať buyerEmail + buyerName.
    const dbUser = user ? await this.prisma.user.findUnique({ where: { id: user.sub } }) : null;
    const buyerEmail = dto.buyerEmail ?? user?.email;
    if (!buyerEmail) throw codedBadRequest('BUYER_EMAIL_REQUIRED', 'E-mail kupujúceho je povinný');
    const buyerName =
      dto.buyerName?.trim() ||
      (dbUser ? `${dbUser.firstName ?? ''} ${dbUser.lastName ?? ''}`.trim() : '');
    if (!buyerName) throw codedBadRequest('BUYER_NAME_REQUIRED', 'Meno kupujúceho je povinné');

    const expiryMinutes = this.config.get<number>('ORDER_EXPIRY_MINUTES', 30);
    const expiresAt = new Date(Date.now() + Number(expiryMinutes) * 60 * 1000);

    const baseOrderData = {
      organizerId: termin.show.organizerId,
      userId: user?.sub ?? null,
      buyerEmail,
      buyerName,
      buyerPhone: dto.buyerPhone,
      currency,
      locale: dto.locale ?? 'sk',  // Krok 31e1: jazyk pre e-maily (aj async Stripe webhook)
      totalAmount,
      status: OrderStatus.PENDING,
      expiresAt,
    };

    const hasSeated = preparedItems.some((p) => p.seatIds && p.seatIds.length > 0);

    // orderNumber sa generuje z count() → pod súbehom môže kolidovať (P2002). Retry s prepočtom.
    const order = await this.withOrderNumberRetry(async (orderNumber) => {
      const orderData: Prisma.OrderUncheckedCreateInput = { ...baseOrderData, orderNumber };

      if (!hasSeated) {
        // GENERAL + SECTIONED: jeden create, bez seat-locku (nezmenené správanie).
        return this.prisma.order.create({
          data: { ...orderData, items: { create: preparedItems.map((p) => p.data) } },
          include: { items: true },
        });
      }

      // SEATED (príp. mix so SECTIONED): transakcia s ATOMICKÝM claimom sedadiel.
      // Podmienený UPDATE (status=AVAILABLE → HELD) je race-safe: súbežný claim toho istého
      // sedadla nájde 0 riadkov → 409 a celá objednávka sa rollbackne (order.create je prvý
      // príkaz, takže kolízia orderNumber rollbackne pred claimom – žiadne uviaznuté HELD).
      return this.prisma.$transaction(async (tx) => {
        const o = await tx.order.create({ data: orderData });
        for (const p of preparedItems) {
          const oi = await tx.orderItem.create({ data: { ...p.data, order: { connect: { id: o.id } } } });
          if (p.seatIds?.length) {
            for (const seatId of p.seatIds) {
              const claimed = await tx.terminSeat.updateMany({
                where: { terminId: termin.id, seatId, status: SeatStatus.AVAILABLE },
                data: { status: SeatStatus.HELD, orderId: o.id, orderItemId: oi.id, heldAt: new Date() },
              });
              if (claimed.count === 0) {
                throw codedConflict('SEAT_TAKEN', 'Niektoré sedadlo medzitým obsadil iný zákazník – vyberte iné.');
              }
            }
          }
        }
        return tx.order.findUnique({ where: { id: o.id }, include: { items: true } });
      });
    });

    // Záznam súhlasu s VOP (krok 44). acceptTerms=true už vynútil ValidationPipe
    // (CreateOrderDto @IsIn([true])), takže bez súhlasu sa sem nedôjde – toto je
    // audit stopa „s ktorou verziou súhlasil". Best-effort: chyba záznamu nesmie
    // zhodiť už vytvorenú (zaplatiteľnú) objednávku.
    if (order) {
      await this.recordPurchaseConsent(order.id, user?.sub ?? null, ipAddress, userAgent);
    }
    return order;
  }

  /**
   * Zapíše TermsAcceptance pre nákup (BUYER_PURCHASE). Funguje pre prihláseného
   * (userId) aj hosťa (userId null) – väzba je vždy cez orderId. Verzia sa nesie
   * cez termsVersionId. Ak aktívne znenie neexistuje, len zaloguje (nezablokuje nákup).
   */
  private async recordPurchaseConsent(
    orderId: string,
    userId: string | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const terms = await this.prisma.termsVersion.findFirst({
        where: { type: TermsType.BUYER_PURCHASE, isActive: true, organizerId: null },
        orderBy: { publishedAt: 'desc' },
        select: { id: true },
      });
      if (!terms) {
        this.logger.warn(`Súhlas s VOP nezaznamenaný pre objednávku ${orderId}: žiadne aktívne BUYER_PURCHASE znenie.`);
        return;
      }
      await this.prisma.termsAcceptance.create({
        data: { termsVersionId: terms.id, userId, orderId, ipAddress, userAgent },
      });
    } catch (e: any) {
      this.logger.error(`Záznam súhlasu s VOP pre objednávku ${orderId} zlyhal: ${e.message}`);
    }
  }

  /**
   * Vytvorí objednávku s číslom MT-RRRR-NNNNN; pri kolízii orderNumber (P2002, súbeh) prepočíta
   * a skúsi znova (max 5×). ConflictException (obsadené sedadlo) sa NEretryuje – prebublá hore.
   */
  private async withOrderNumberRetry<T>(fn: (orderNumber: string) => Promise<T>): Promise<T> {
    const year = new Date().getFullYear();
    for (let attempt = 0; ; attempt++) {
      const count = await this.prisma.order.count();
      const orderNumber = `MT-${year}-${String(count + 1).padStart(5, '0')}`;
      try {
        return await fn(orderNumber);
      } catch (e) {
        const isOrderNumberCollision =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          (e.meta?.target as string[] | undefined)?.includes('orderNumber');
        if (isOrderNumberCollision && attempt < 5) continue;
        throw e;
      }
    }
  }

  async getOrder(id: string, user?: JwtPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { ticketType: true } },
        tickets: { select: { id: true, status: true, ticketTypeId: true, qrToken: true } },
      },
    });
    if (!order) throw new NotFoundException();
    // Guest order (userId=null) → autorizácia cez cuid id; user order → musí sedieť vlastník.
    if (order.userId && order.userId !== user?.sub) throw new ForbiddenException();
    // Po PAID priložíme bezstavový 1h guest token → success stránka ním zobrazí/stiahne lístky
    // (aj neprihlásený hosť; po expirácii je odkaz mŕtvy). Approach (a): token vzniká pri pollingu.
    if (order.status === OrderStatus.PAID) {
      const secret = guestTicketSecret(
        this.config.get<string>('QR_HMAC_SECRET'),
        this.config.get<string>('JWT_SECRET'),
      );
      return { ...order, guestTicketToken: signGuestTicketToken(order.id, secret) };
    }
    return order;
  }

  async initiateCheckout(
    orderId: string,
    user?: JwtPayload,
    clientOrigin?: string,
    couponCode?: string,
  ): Promise<{ url: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { ticketType: true, termin: { select: { id: true, showId: true } } } },
      },
    });
    if (!order) throw new NotFoundException();
    // Guest order (userId=null) → autorizácia cez cuid id; user order → musí sedieť vlastník.
    if (order.userId && order.userId !== user?.sub) throw new ForbiddenException();
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order is not pending (status: ${order.status})`);
    }

    const appBaseUrl = clientOrigin ?? this.config.get('APP_BASE_URL', 'https://ticketall.eu');
    const successUrl = `${appBaseUrl}/checkout/success/${orderId}`;
    const cancelUrl = `${appBaseUrl}/checkout/cancel`;

    // Default: per-item line items (žiadna zmena pre objednávky bez kupónu)
    let lineItems = order.items.map((item) => ({
      name: (item.priceSnapshot as any)?.name ?? item.ticketType?.name ?? 'Vstupenka',
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
    }));

    // Základ pre poplatok = suma lístkov PO zľave (čo zákazník reálne platí za lístky).
    let chargeBase = Number(order.totalAmount);

    // Kupón (voliteľný): server-side RE-validácia (nedôverujeme klientovi)
    if (couponCode) {
      const subtotal = order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
      const validation = await this.coupons.validate({
        code: couponCode,
        subtotal,
        items: order.items
          .filter((i) => i.ticketTypeId)
          .map((i) => ({ ticketTypeId: i.ticketTypeId!, quantity: i.quantity })),
        userId: order.userId ?? undefined,
      });
      if ('reason' in validation) throw new BadRequestException(validation.reason);

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          couponId: validation.couponId,
          discountAmount: validation.discount,
          totalAmount: validation.finalAmount,
        },
      });
      chargeBase = validation.finalAmount;

      // Stripe vidí len finálnu sumu – jeden konsolidovaný riadok (per-item rozpis ostáva v našom Order)
      lineItems = [
        {
          name: `Objednávka ${order.orderNumber} (zľava ${validation.discount} ${order.currency})`,
          unitPrice: validation.finalAmount,
          quantity: 1,
        },
      ];
    }

    // ── Zákaznícky poplatok za spracovanie (Krok 2/2, online checkout) ──────────
    // % z organizátora podujatia – číta sa SERVER-SIDE, do UI/Stripe ide len suma.
    const organizer = await this.prisma.organizer.findUnique({
      where: { id: order.organizerId },
      select: { customerFeePercent: true },
    });
    const feePct = Number(organizer?.customerFeePercent ?? 0);
    // round na centy; free lístky (chargeBase 0) → 0.
    const customerFeeAmount = chargeBase > 0 ? Math.round(chargeBase * feePct) / 100 : 0;

    await this.prisma.order.update({
      where: { id: orderId },
      data: { feeAmount: customerFeeAmount, customerFeePct: feePct },
    });

    if (customerFeeAmount > 0) {
      lineItems.push({
        name: FEE_LABEL[order.locale] ?? FEE_LABEL.sk,
        unitPrice: customerFeeAmount,
        quantity: 1,
      });
    }

    // Úloha 25: provider aktívnej brány. Default STRIPE_LIVE → ten istý injektovaný instance ako
    // doteraz (this.paymentProvider) → byte-identické správanie. Iné brány len po prepnutí SUPERADMIN-om.
    const provider = await this.gateways.getActiveProvider();

    // Úloha 26: metadata pre Stripe (filtrovanie/hromadný refund pri zrušení podujatia).
    const firstTermin = order.items.find((i) => i.termin)?.termin;
    const metadata: Record<string, string> = {
      orderRef: order.orderNumber,
      ...(firstTermin ? { eventId: firstTermin.showId, occurrenceId: firstTermin.id } : {}),
    };

    const result = await provider.createCheckoutSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      currency: order.currency,
      items: lineItems,
      customerEmail: order.buyerEmail,
      successUrl,
      cancelUrl,
      metadata,
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentRef: result.externalId,
        paymentProvider: result.synchronous ? 'mock' : 'stripe',
      },
    });

    if (result.synchronous) {
      await this.fulfillOrder(orderId, 'mock', result.externalId);
    }

    return { url: result.checkoutUrl };
  }

  /**
   * QR rýchly nákup (scan-to-buy): guest objednávka pre 1 GA typ lístka × quantity → Stripe Checkout.
   * Reuse: rovnaká objednávka + initiateCheckout ako bežný online predaj (fee, provízia, webhook, e-mail).
   * Žiadna eKasa (bežný online predaj). source='QR' pre štatistiku.
   */
  async qrCheckout(
    dto: { ticketTypeId: string; quantity: number; email: string; locale?: string },
    origin?: string,
  ): Promise<{ url: string }> {
    const tt = await this.prisma.ticketType.findUnique({
      where: { id: dto.ticketTypeId },
      include: { termin: { include: { show: true } } },
    });
    if (!tt) throw codedNotFound('TICKET_TYPE_NOT_FOUND', 'Typ lístka neexistuje.');
    const termin = tt.termin;

    if (termin.mode !== TerminMode.GENERAL) {
      throw codedBadRequest('NOT_GA', 'QR nákup je dostupný len pre podujatia s voľným sedením.');
    }
    if (!tt.qrPaymentEnabled) throw codedBadRequest('QR_DISABLED', 'QR predaj nie je pre tento lístok dostupný.');
    if (!tt.isActive) throw codedBadRequest('TICKET_TYPE_INACTIVE', 'Typ lístka nie je aktívny.');
    if (termin.status !== TerminStatus.ON_SALE) throw codedBadRequest('EVENT_NOT_AVAILABLE', 'Podujatie nie je v predaji.');
    if (termin.startsAt < new Date()) throw codedBadRequest('EVENT_PAST', 'Podujatie už prebehlo.');

    const now = new Date();
    if (tt.saleStartsAt && now < tt.saleStartsAt) throw codedBadRequest('SALE_NOT_STARTED', 'Predaj sa ešte nezačal.');
    if (tt.saleEndsAt && now > tt.saleEndsAt) throw codedBadRequest('SALE_ENDED', 'Predaj už skončil.');

    const qty = Math.floor(Number(dto.quantity));
    if (!qty || qty < 1) throw codedBadRequest('TICKET_QTY_REQUIRED', 'Zadajte počet lístkov.');
    const cap = Math.min(10, tt.maxPerOrder);
    if (qty > cap) throw codedBadRequest('MAX_PER_ORDER', `Maximálne ${cap} ks na objednávku.`, { max: cap });

    if (tt.totalQuantity != null) {
      const sold = await this.prisma.orderItem.aggregate({
        where: { ticketTypeId: tt.id, order: { status: { in: [OrderStatus.PENDING, OrderStatus.PAID] } } },
        _sum: { quantity: true },
      });
      const remaining = tt.totalQuantity - (sold._sum.quantity ?? 0);
      if (remaining < qty) throw codedBadRequest('TICKET_INSUFFICIENT', `Zostáva len ${remaining} ks.`, { remaining });
    }

    const buyerEmail = dto.email?.trim();
    if (!buyerEmail) throw codedBadRequest('BUYER_EMAIL_REQUIRED', 'E-mail je povinný.');

    const expiryMinutes = this.config.get<number>('ORDER_EXPIRY_MINUTES', 30);
    const expiresAt = new Date(Date.now() + Number(expiryMinutes) * 60 * 1000);

    const order = await this.withOrderNumberRetry((orderNumber) =>
      this.prisma.order.create({
        data: {
          orderNumber,
          organizerId: termin.show.organizerId,
          userId: null,
          buyerEmail,
          buyerName: 'QR nákup',
          currency: tt.currency,
          locale: dto.locale ?? 'sk',
          totalAmount: Number(tt.price) * qty,
          status: OrderStatus.PENDING,
          source: 'QR',
          expiresAt,
          items: {
            create: [{
              ticketType: { connect: { id: tt.id } },
              termin: { connect: { id: termin.id } },
              quantity: qty,
              unitPrice: tt.price,
              currency: tt.currency,
              priceSnapshot: {
                name: tt.name,
                price: Number(tt.price),
                currency: tt.currency,
                showName: termin.show.name,
                terminId: termin.id,
                startsAt: termin.startsAt,
              },
            }],
          },
        },
        include: { items: true },
      }),
    );

    return this.initiateCheckout(order.id, undefined, origin);
  }

  /**
   * Marks an order PAID, generates tickets and sends the confirmation e-mail.
   * Idempotent via optimistic-lock: if status is no longer PENDING, throws BadRequest.
   */
  async fulfillOrder(orderId: string, provider: string, paymentRef?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            ticketType: true,
            termin: { include: { show: true, venue: true } },
            terminSection: { include: { section: true } },
          },
        },
        // Úloha 22/3b: držané sedadlá (HELD) objednávky – pre tickety + prechod na SOLD.
        terminSeats: { include: { seat: { include: { row: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const hmacSecret =
      this.config.get<string>('QR_HMAC_SECRET') ?? this.config.get<string>('JWT_SECRET')!;

    // Sedadlá zoskupené podľa OrderItem (SEATED položky → 1 ticket na sedadlo).
    const seatsByItem = new Map<string, typeof order.terminSeats>();
    for (const tseat of order.terminSeats) {
      if (!tseat.orderItemId) continue;
      const arr = seatsByItem.get(tseat.orderItemId) ?? [];
      arr.push(tseat);
      seatsByItem.set(tseat.orderItemId, arr);
    }

    // Atomic status transition: only succeeds if order is still PENDING
    const tickets = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          paymentProvider: provider,
          ...(paymentRef ? { paymentRef } : {}),
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(`Order ${orderId} is no longer pending`);
      }

      const created: any[] = [];
      const makeTicket = async (item: (typeof order.items)[number], seat?: (typeof order.terminSeats)[number]) => {
        const ticketId = randomUUID();
        const nonce = randomUUID();
        const qrToken = this.signQrToken(ticketId, item.terminId!, nonce, hmacSecret);
        const ticket = await tx.ticket.create({
          data: {
            id: ticketId,
            orderId,
            orderItemId: item.id,
            // GENERAL: ticketTypeId. SEATMAP/SECTIONED/SEATED: ticketTypeId null + terminSectionId + názov sekcie.
            ticketTypeId: item.ticketTypeId,
            terminId: item.terminId!,
            terminSectionId: item.terminSectionId,
            seatSection: item.terminSection?.section.name ?? null,
            // SEATED (úloha 22/3b): konkrétne sedadlo + labely.
            seatId: seat?.seatId ?? null,
            seatRow: seat?.seat.row.label ?? null,
            seatNumber: seat?.seat.label ?? null,
            nonce,
            qrToken,
            status: TicketStatus.VALID,
          },
        });
        created.push({ ...ticket, ticketType: item.ticketType, termin: item.termin });
      };

      for (const item of order.items) {
        const itemSeats = seatsByItem.get(item.id);
        if (itemSeats && itemSeats.length > 0) {
          // SEATED: jeden lístok na konkrétne sedadlo.
          for (const seat of itemSeats) await makeTicket(item, seat);
        } else {
          // GENERAL/SECTIONED: počet lístkov = quantity (nezmenené).
          for (let i = 0; i < item.quantity; i++) await makeTicket(item);
        }
      }

      // Úloha 22/3b: držané sedadlá → SOLD (v rámci tej istej PAID transakcie).
      await tx.terminSeat.updateMany({
        where: { orderId, status: SeatStatus.HELD },
        data: { status: SeatStatus.SOLD },
      });
      return created;
    });

    const firstItem = order.items[0];
    const termin = firstItem?.termin;
    const show = termin?.show;
    const venue = termin?.venue;

    sendTicketsForOrder(orderId, this.prisma, this.mail, this.logger)
      .catch((e) => this.logger.error(`Email failed for order ${orderId}: ${e.message}`));

    // Redeem kupónu po PAID (idempotentné – no-op ak bez kupónu alebo už redeemnuté)
    this.coupons.redeemForPaidOrder(orderId)
      .catch((e) => this.logger.error(`Coupon redeem failed for order ${orderId}: ${e.message}`));
  }

  async compOrder(dto: CompOrderDto): Promise<{ orderId: string; ticketCount: number }> {
    const termin = await this.prisma.termin.findFirst({
      where: {
        id: dto.terminId,
        showId: dto.showId,
        status: { in: [TerminStatus.ON_SALE, TerminStatus.COMING_SOON, TerminStatus.SOLD_OUT] },
      },
      include: { show: true },
    });
    if (!termin) throw new NotFoundException('Termin not found or not active');

    const tt = await this.prisma.ticketType.findFirst({
      where: { id: dto.ticketTypeId, terminId: dto.terminId, isActive: true },
    });
    if (!tt) throw new NotFoundException('TicketType not found or inactive');

    const hmacSecret =
      this.config.get<string>('QR_HMAC_SECRET') ?? this.config.get<string>('JWT_SECRET')!;

    // Auto-link to an existing account so the tickets show up in /account/tickets
    // (getMyTickets filters by Order.userId). If no account yet, stays null and
    // gets linked on customer registration (see registerCustomer).
    const buyerUser = await this.prisma.user.findUnique({ where: { email: dto.buyerEmail } });

    const year = new Date().getFullYear();
    const count = await this.prisma.order.count();
    const orderNumber = `MT-${year}-${String(count + 1).padStart(5, '0')}`;

    const orderId = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          organizerId: termin.show.organizerId,
          userId: buyerUser?.id ?? null,
          buyerEmail: dto.buyerEmail,
          buyerName: dto.buyerName,
          currency: tt.currency,
          totalAmount: 0,
          status: OrderStatus.PAID,
          paidAt: new Date(),
          paymentProvider: 'comp',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          items: {
            create: [{
              ticketTypeId: tt.id,
              terminId: termin.id,
              quantity: dto.quantity,
              unitPrice: 0,
              currency: tt.currency,
              priceSnapshot: {
                name: tt.name,
                price: 0,
                currency: tt.currency,
                showName: termin.show.name,
                terminId: termin.id,
                startsAt: termin.startsAt,
              },
            }],
          },
        },
        include: { items: true },
      });

      const itemId = order.items[0].id;
      for (let i = 0; i < dto.quantity; i++) {
        const ticketId = randomUUID();
        const nonce = randomUUID();
        const qrToken = this.signQrToken(ticketId, termin.id, nonce, hmacSecret);
        await tx.ticket.create({
          data: {
            id: ticketId,
            orderId: order.id,
            orderItemId: itemId,
            ticketTypeId: tt.id,
            terminId: termin.id,
            nonce,
            qrToken,
            status: TicketStatus.VALID,
          },
        });
      }
      return order.id;
    });

    sendTicketsForOrder(orderId, this.prisma, this.mail, this.logger)
      .catch((e) => this.logger.error(`Comp order email failed for ${orderId}: ${e.message}`));

    return { orderId, ticketCount: dto.quantity };
  }

  /**
   * Best-effort zápis posledných 4 čísel karty (zo Stripe webhooku). Nekritické –
   * nikdy nesmie zhodiť fulfillment. Podklad pre budúce overenie identity guest zákazníka.
   */
  async setCardLast4(orderId: string, last4: string): Promise<void> {
    if (!/^\d{4}$/.test(last4)) return;
    await this.prisma.order.update({ where: { id: orderId }, data: { cardLast4: last4 } });
  }

  async resendTickets(orderId: string): Promise<{ orderId: string; message: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(`Order status is ${order.status}, expected PAID`);
    }
    await sendTicketsForOrder(orderId, this.prisma, this.mail, this.logger);
    return { orderId, message: 'Tickets resent successfully' };
  }

  /**
   * Stores a Stripe event ID. Returns true if the event was already recorded (duplicate).
   */
  async recordStripeEvent(eventId: string): Promise<boolean> {
    try {
      await this.prisma.stripeEvent.create({ data: { id: eventId } });
      return false;
    } catch (e: any) {
      if (e.code === 'P2002') return true; // unique constraint – already processed
      throw e;
    }
  }

  /** Dev-only mock payment: kept as convenience fallback (PAYMENT_PROVIDER=mock only). */
  async mockPay(id: string, user: JwtPayload) {
    if (this.config.get('PAYMENT_PROVIDER', 'mock') !== 'mock') {
      throw new ForbiddenException('Mock payments are disabled');
    }
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException();
    if (order.userId !== user.sub) throw new ForbiddenException();
    await this.fulfillOrder(id, 'mock');
    return this.getOrder(id, user);
  }

  async getMyTickets(user: JwtPayload) {
    return this.prisma.ticket.findMany({
      where: { order: { userId: user.sub }, status: TicketStatus.VALID },
      include: {
        ticketType: { select: { name: true, price: true, currency: true } },
        termin: {
          select: {
            startsAt: true, timezone: true,
            show: { select: { name: true, slug: true } },
            venue: { select: { name: true, city: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyTicket(ticketId: string, user: JwtPayload) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        ticketType: { select: { name: true, price: true, currency: true } },
        order: { select: { orderNumber: true, userId: true } },
        termin: {
          select: {
            startsAt: true, timezone: true, doorsOpenAt: true,
            show: { select: { name: true, slug: true } },
            venue: { select: { name: true, city: true, street: true } },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException();
    if (ticket.order.userId !== user.sub) throw new ForbiddenException();
    return ticket;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingOrders() {
    const expiring = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING, expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    if (expiring.length === 0) return;
    const ids = expiring.map((o) => o.id);

    await this.prisma.$transaction([
      // Úloha 22/3b: uvoľni držané sedadlá (HELD → AVAILABLE) expirovaných objednávok.
      this.prisma.terminSeat.updateMany({
        where: { orderId: { in: ids }, status: SeatStatus.HELD },
        data: { status: SeatStatus.AVAILABLE, orderId: null, orderItemId: null, heldAt: null },
      }),
      this.prisma.order.updateMany({
        where: { id: { in: ids }, status: OrderStatus.PENDING },
        data: { status: OrderStatus.CANCELLED },
      }),
    ]);
    this.logger.log(`Expired ${ids.length} pending order(s)`);
  }

  /** Úloha 22/3b: uvoľní sedadlá objednávky späť na AVAILABLE (cancel/refund). */
  async releaseSeatsForOrder(orderId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    await client.terminSeat.updateMany({
      where: { orderId, status: { in: [SeatStatus.HELD, SeatStatus.SOLD] } },
      data: { status: SeatStatus.AVAILABLE, orderId: null, orderItemId: null, heldAt: null },
    });
  }

  // ── POS (pokladňa na mieste) ────────────────────────────────────────────────
  private readonly POS_SENTINEL_EMAIL = 'pos@ticketall.eu';

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  /** Najbližšie predajné termíny callera (dnešné + budúce) s dostupnosťou – pre POS výber. */
  async posTermins(user: JwtPayload) {
    const orgFilter = this.isSuperOrStaff(user)
      ? {}
      : { show: { organizerId: user.organizerId! } };
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const terminy = await this.prisma.termin.findMany({
      where: {
        ...orgFilter,
        status: { in: [TerminStatus.ON_SALE, TerminStatus.SOLD_OUT] },
        OR: [{ startsAt: { gte: startOfToday } }, { endsAt: { gte: now } }],
      },
      include: {
        show: { select: { name: true } },
        venue: { select: { name: true, city: true } },
        ticketTypes: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { startsAt: 'asc' },
    });

    const ttIds = terminy.flatMap((t) => t.ticketTypes.map((tt) => tt.id));
    const soldRows = ttIds.length
      ? await this.prisma.orderItem.groupBy({
          by: ['ticketTypeId'],
          where: {
            ticketTypeId: { in: ttIds },
            order: { status: { in: [OrderStatus.PENDING, OrderStatus.PAID] } },
          },
          _sum: { quantity: true },
        })
      : [];
    const soldMap = new Map(soldRows.map((r) => [r.ticketTypeId, r._sum.quantity ?? 0]));

    return terminy.map((t) => ({
      terminId: t.id,
      showName: t.show.name,
      startsAt: t.startsAt,
      venueName: t.venue?.name ?? null,
      venueCity: t.venue?.city ?? null,
      mode: t.mode, // GENERAL = GA (QR platba dostupná), SEATMAP = sedadlové
      ticketTypes: t.ticketTypes.map((tt) => ({
        ticketTypeId: tt.id,
        name: tt.name,
        price: Number(tt.price),
        currency: tt.currency,
        maxPerOrder: tt.maxPerOrder,
        qrPaymentEnabled: tt.qrPaymentEnabled,
        remaining:
          tt.totalQuantity == null
            ? null
            : Math.max(0, tt.totalQuantity - (soldMap.get(tt.id) ?? 0)),
      })),
    }));
  }

  /** POS predaj: okamžitý PAID order + lístky, voliteľný email/anonymný, kupóny. */
  async posOrder(dto: PosOrderDto, user: JwtPayload) {
    const termin = await this.prisma.termin.findUnique({
      where: { id: dto.terminId },
      include: { show: true, ticketTypes: true },
    });
    if (!termin) throw codedNotFound('TERMIN_NOT_FOUND', 'Termín neexistuje.');
    if (!this.isSuperOrStaff(user) && termin.show.organizerId !== user.organizerId) {
      throw new ForbiddenException('Termín nepatrí vašej organizácii.');
    }
    if (termin.status !== TerminStatus.ON_SALE && termin.status !== TerminStatus.SOLD_OUT) {
      throw codedBadRequest('EVENT_NOT_AVAILABLE', 'Termín nie je v predaji.');
    }

    // Validácia položiek + dostupnosti (zhodné s web createOrder)
    let subtotal = 0;
    const validated: { tt: any; quantity: number }[] = [];
    const now = new Date();
    for (const item of dto.items) {
      const tt = termin.ticketTypes.find((t) => t.id === item.ticketTypeId);
      if (!tt) throw codedNotFound('TICKET_TYPE_NOT_FOUND', `Typ lístka ${item.ticketTypeId} neexistuje.`, { ticketType: item.ticketTypeId ?? '' });
      if (!tt.isActive) throw codedBadRequest('TICKET_TYPE_INACTIVE', `Typ lístka "${tt.name}" nie je aktívny.`, { name: tt.name });
      if (item.quantity > tt.maxPerOrder) {
        throw codedBadRequest('MAX_PER_ORDER', `Max ${tt.maxPerOrder} ks typu "${tt.name}" na objednávku.`, { max: tt.maxPerOrder, name: tt.name });
      }
      if (tt.saleStartsAt && now < tt.saleStartsAt) {
        throw codedBadRequest('SALE_NOT_STARTED', `Predaj "${tt.name}" sa ešte nezačal.`, { name: tt.name });
      }
      if (tt.saleEndsAt && now > tt.saleEndsAt) {
        throw codedBadRequest('SALE_ENDED', `Predaj "${tt.name}" už skončil.`, { name: tt.name });
      }
      if (tt.totalQuantity != null) {
        const sold = await this.prisma.orderItem.aggregate({
          where: {
            ticketTypeId: tt.id,
            order: { status: { in: [OrderStatus.PENDING, OrderStatus.PAID] } },
          },
          _sum: { quantity: true },
        });
        const remaining = tt.totalQuantity - (sold._sum.quantity ?? 0);
        if (remaining < item.quantity) {
          throw codedBadRequest('TICKET_INSUFFICIENT', `Zostáva len ${remaining} ks typu "${tt.name}".`, { remaining, name: tt.name });
        }
      }
      subtotal += Number(tt.price) * item.quantity;
      validated.push({ tt, quantity: item.quantity });
    }
    if (validated.length === 0) throw codedBadRequest('ORDER_EMPTY', 'Objednávka neobsahuje žiadne lístky.');

    // Kupón (voliteľný)
    let discountAmount = 0;
    let couponId: string | null = null;
    let totalAmount = subtotal;
    if (dto.couponCode) {
      const validation = await this.coupons.validate({
        code: dto.couponCode,
        subtotal,
        items: validated.map(({ tt, quantity }) => ({ ticketTypeId: tt.id, quantity })),
      });
      if ('reason' in validation) throw new BadRequestException(validation.reason);
      discountAmount = validation.discount;
      couponId = validation.couponId;
      totalAmount = validation.finalAmount;
    }

    const provider = dto.paymentMethod === 'card' ? 'pos_card' : 'pos_cash';
    const currency = validated[0].tt.currency ?? 'EUR';
    const hasEmail = !!dto.buyerEmail?.trim();
    const buyerEmail = hasEmail ? dto.buyerEmail!.trim() : this.POS_SENTINEL_EMAIL;
    const buyerName = dto.buyerName?.trim() || 'POS predaj';
    const buyerUser = hasEmail
      ? await this.prisma.user.findUnique({ where: { email: buyerEmail } })
      : null;

    const hmacSecret =
      this.config.get<string>('QR_HMAC_SECRET') ?? this.config.get<string>('JWT_SECRET')!;

    const year = new Date().getFullYear();
    const count = await this.prisma.order.count();
    const orderNumber = `MT-${year}-${String(count + 1).padStart(5, '0')}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          organizerId: termin.show.organizerId,
          userId: buyerUser?.id ?? null,
          buyerEmail,
          buyerName,
          currency,
          totalAmount,
          discountAmount,
          couponId,
          status: OrderStatus.PAID,
          paidAt: new Date(),
          paymentProvider: provider,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          items: {
            create: validated.map(({ tt, quantity }) => ({
              ticketTypeId: tt.id,
              terminId: termin.id,
              quantity,
              unitPrice: tt.price,
              currency: tt.currency,
              priceSnapshot: {
                name: tt.name,
                price: Number(tt.price),
                currency: tt.currency,
                showName: termin.show.name,
                terminId: termin.id,
                startsAt: termin.startsAt,
              },
            })),
          },
        },
        include: { items: true },
      });

      const tickets: { ticketId: string; ticketTypeName: string; qrToken: string }[] = [];
      for (const orderItem of order.items) {
        const v = validated.find((x) => x.tt.id === orderItem.ticketTypeId);
        const ttName = v?.tt.name ?? 'Vstupenka';
        for (let i = 0; i < orderItem.quantity; i++) {
          const ticketId = randomUUID();
          const nonce = randomUUID();
          const qrToken = this.signQrToken(ticketId, termin.id, nonce, hmacSecret);
          await tx.ticket.create({
            data: {
              id: ticketId,
              orderId: order.id,
              orderItemId: orderItem.id,
              ticketTypeId: orderItem.ticketTypeId!,
              terminId: termin.id,
              nonce,
              qrToken,
              status: TicketStatus.VALID,
            },
          });
          tickets.push({ ticketId, ticketTypeName: ttName, qrToken });
        }
      }
      return { order, tickets };
    });

    // Redeem kupónu (idempotentné) – až po PAID
    if (couponId) {
      this.coupons
        .redeemForPaidOrder(result.order.id)
        .catch((e) => this.logger.error(`POS coupon redeem failed for ${result.order.id}: ${e.message}`));
    }
    // Email len ak bol zadaný reálny buyerEmail (anonymný predaj = QR na obrazovke)
    if (hasEmail) {
      sendTicketsForOrder(result.order.id, this.prisma, this.mail, this.logger)
        .catch((e) => this.logger.error(`POS email failed for ${result.order.id}: ${e.message}`));
    }

    // eKasa fiškalizácia (za flagom EKASA_ENABLED). Nikdy nezhadzuje predaj:
    // OFFLINE/FAILED sa uloží k objednávke a vráti v odpovedi (UI to zobrazí).
    const ekasaResult = await this.ekasa.registerSaleForOrder(result.order.id);

    return {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      totalAmount: Number(result.order.totalAmount),
      discountAmount: Number(result.order.discountAmount),
      currency,
      emailSent: hasEmail,
      tickets: result.tickets,
      ekasa: ekasaResult, // null ak flag off / bez zariadenia
    };
  }

  /** Dodatočné odoslanie POS lístkov e-mailom (napr. po anonymnom predaji). */
  async posEmailTickets(orderId: string, email: string, user: JwtPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, organizerId: true, paymentProvider: true },
    });
    if (!order) throw new NotFoundException('Objednávka neexistuje.');
    if (!this.isSuperOrStaff(user) && order.organizerId !== user.organizerId) {
      throw new ForbiddenException('Objednávka nepatrí vašej organizácii.');
    }
    if (!order.paymentProvider?.startsWith('pos_')) {
      throw new BadRequestException('Nie je to POS objednávka.');
    }
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      throw new BadRequestException('Neplatný e-mail.');
    }
    await this.prisma.order.update({ where: { id: orderId }, data: { buyerEmail: clean } });
    await sendTicketsForOrder(orderId, this.prisma, this.mail, this.logger);
    return { sent: true, email: clean };
  }

  // ── POS uzávierka (17-B) ─────────────────────────────────────────────────────

  /** Org callera: organizer = vlastný; super/staff = z parametra (povinné). */
  private resolvePosOrg(user: JwtPayload, requested?: string): string {
    if (this.isSuperOrStaff(user)) {
      if (!requested) throw new BadRequestException('organizerId je povinný pre SUPERADMIN/STAFF.');
      return requested;
    }
    if (!user.organizerId) throw new ForbiddenException();
    return user.organizerId;
  }

  /**
   * Agregácia POS predajov od poslednej uzávierky po `upperBound`.
   * Súvislé obdobia: periodFrom = posledná closure.periodTo (alebo prvý POS predaj).
   */
  private async computePosSummary(organizerId: string, upperBound: Date) {
    const last = await this.prisma.posClosure.findFirst({
      where: { organizerId },
      orderBy: { createdAt: 'desc' },
      select: { periodTo: true },
    });
    const periodFrom = last?.periodTo ?? null;

    const where: Prisma.OrderWhereInput = {
      organizerId,
      status: OrderStatus.PAID,
      paymentProvider: { in: ['pos_cash', 'pos_card'] },
      createdAt: { ...(periodFrom ? { gt: periodFrom } : {}), lte: upperBound },
    };

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        orderNumber: true,
        paymentProvider: true,
        totalAmount: true,
        createdAt: true,
        _count: { select: { tickets: true } },
        items: {
          take: 1,
          select: { termin: { select: { startsAt: true, show: { select: { name: true } } } } },
        },
      },
    });

    let cashTotal = 0;
    let cardTotal = 0;
    let ticketCount = 0;
    const orderNumbers: string[] = [];
    const terminMap = new Map<string, PosClosureByTermin>();

    for (const o of orders) {
      const amt = Number(o.totalAmount);
      const tk = o._count.tickets;
      ticketCount += tk;
      orderNumbers.push(o.orderNumber);
      const isCash = o.paymentProvider === 'pos_cash';
      if (isCash) cashTotal += amt; else cardTotal += amt;

      const termin = o.items[0]?.termin;
      const key = termin ? `${termin.show?.name}|${termin.startsAt?.toISOString()}` : 'unknown';
      const entry = terminMap.get(key) ?? {
        showTitle: termin?.show?.name ?? null,
        terminStartsAt: termin?.startsAt ?? null,
        cash: 0,
        card: 0,
        tickets: 0,
      };
      if (isCash) entry.cash += amt; else entry.card += amt;
      entry.tickets += tk;
      terminMap.set(key, entry);
    }

    const earliest = orders[0]?.createdAt ?? null;
    const byTermin = [...terminMap.values()].sort(
      (a, b) => (a.terminStartsAt?.getTime() ?? 0) - (b.terminStartsAt?.getTime() ?? 0),
    );

    return {
      periodFrom: periodFrom ?? earliest,
      cashTotal,
      cardTotal,
      total: cashTotal + cardTotal,
      orderCount: orders.length,
      ticketCount,
      byTermin,
      orderNumbers,
    };
  }

  /** Živý prehľad POS predajov od poslednej uzávierky. */
  async posSummary(user: JwtPayload, organizerId?: string) {
    const orgId = this.resolvePosOrg(user, organizerId);
    const now = new Date();
    const s = await this.computePosSummary(orgId, now);
    return {
      periodFrom: s.periodFrom,
      now,
      cashTotal: s.cashTotal,
      cardTotal: s.cardTotal,
      total: s.total,
      orderCount: s.orderCount,
      ticketCount: s.ticketCount,
      byTermin: s.byTermin,
    };
  }

  /** Vytvorí uzávierku (snapshot). Len OWNER + super/staff (MEMBER 403). */
  async posCreateClosure(user: JwtPayload, note?: string, organizerId?: string) {
    if (!this.isSuperOrStaff(user) && user.role !== UserRole.ORGANIZER_OWNER) {
      throw new ForbiddenException('Uzávierku môže vykonať len vlastník organizácie.');
    }
    const orgId = this.resolvePosOrg(user, organizerId);
    const now = new Date();
    const s = await this.computePosSummary(orgId, now);
    if (s.orderCount === 0) {
      throw new BadRequestException('Žiadne predaje na uzavretie.');
    }

    const closure = await this.prisma.posClosure.create({
      data: {
        organizerId: orgId,
        closedById: user.sub,
        periodFrom: s.periodFrom ?? now,
        periodTo: now,
        cashTotal: s.cashTotal,
        cardTotal: s.cardTotal,
        orderCount: s.orderCount,
        ticketCount: s.ticketCount,
        note: note?.trim() || null,
      },
    });

    return {
      closure: this.serializeClosure(closure),
      orderNumbers: s.orderNumbers,
    };
  }

  private serializeClosure(c: {
    id: string; organizerId: string; closedById: string;
    periodFrom: Date; periodTo: Date; cashTotal: any; cardTotal: any;
    orderCount: number; ticketCount: number; note: string | null; createdAt: Date;
    closedBy?: { firstName: string | null; lastName: string | null; email: string } | null;
  }) {
    const name = c.closedBy
      ? `${c.closedBy.firstName ?? ''} ${c.closedBy.lastName ?? ''}`.trim() || c.closedBy.email
      : null;
    return {
      id: c.id,
      periodFrom: c.periodFrom,
      periodTo: c.periodTo,
      cashTotal: Number(c.cashTotal),
      cardTotal: Number(c.cardTotal),
      total: Number(c.cashTotal) + Number(c.cardTotal),
      orderCount: c.orderCount,
      ticketCount: c.ticketCount,
      note: c.note,
      closedByName: name,
      createdAt: c.createdAt,
    };
  }

  async posClosuresList(user: JwtPayload, organizerId?: string, limit = 25, offset = 0) {
    const orgId = this.resolvePosOrg(user, organizerId);
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = Math.max(offset, 0);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.posClosure.findMany({
        where: { organizerId: orgId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { closedBy: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.posClosure.count({ where: { organizerId: orgId } }),
    ]);
    return { items: rows.map((r) => this.serializeClosure(r)), total, limit: take, offset: skip };
  }

  /** Vygeneruje PDF report uzávierky (recompute breakdown za uložené obdobie). */
  async posClosurePdf(id: string, user: JwtPayload) {
    const closure = await this.prisma.posClosure.findUnique({
      where: { id },
      include: {
        organizer: { select: { name: true } },
        closedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!closure) throw new NotFoundException('Uzávierka neexistuje.');
    if (!this.isSuperOrStaff(user) && closure.organizerId !== user.organizerId) {
      throw new ForbiddenException('Uzávierka nepatrí vašej organizácii.');
    }

    // Breakdown za uložené obdobie [periodFrom, periodTo]
    const orders = await this.prisma.order.findMany({
      where: {
        organizerId: closure.organizerId,
        status: OrderStatus.PAID,
        paymentProvider: { in: ['pos_cash', 'pos_card'] },
        createdAt: { gt: closure.periodFrom, lte: closure.periodTo },
      },
      select: {
        paymentProvider: true,
        totalAmount: true,
        _count: { select: { tickets: true } },
        items: {
          take: 1,
          select: { termin: { select: { startsAt: true, show: { select: { name: true } } } } },
        },
      },
    });
    const terminMap = new Map<string, PosClosureByTermin>();
    for (const o of orders) {
      const amt = Number(o.totalAmount);
      const isCash = o.paymentProvider === 'pos_cash';
      const termin = o.items[0]?.termin;
      const key = termin ? `${termin.show?.name}|${termin.startsAt?.toISOString()}` : 'unknown';
      const entry = terminMap.get(key) ?? {
        showTitle: termin?.show?.name ?? null,
        terminStartsAt: termin?.startsAt ?? null,
        cash: 0, card: 0, tickets: 0,
      };
      if (isCash) entry.cash += amt; else entry.card += amt;
      entry.tickets += o._count.tickets;
      terminMap.set(key, entry);
    }
    const byTermin = [...terminMap.values()].sort(
      (a, b) => (a.terminStartsAt?.getTime() ?? 0) - (b.terminStartsAt?.getTime() ?? 0),
    );

    const platform = await this.prisma.platformInfo.findFirst();
    const closedByName = closure.closedBy
      ? `${closure.closedBy.firstName ?? ''} ${closure.closedBy.lastName ?? ''}`.trim() || closure.closedBy.email
      : '—';

    const pdf = await generatePosClosurePdf({
      organizerName: closure.organizer?.name ?? '—',
      closedByName,
      periodFrom: closure.periodFrom,
      periodTo: closure.periodTo,
      cashTotal: Number(closure.cashTotal),
      cardTotal: Number(closure.cardTotal),
      total: Number(closure.cashTotal) + Number(closure.cardTotal),
      orderCount: closure.orderCount,
      ticketCount: closure.ticketCount,
      note: closure.note,
      byTermin,
      platformName: platform?.legalName ?? 'TicketAll',
    });
    return { pdf, filename: `uzavierka-${closure.id}.pdf` };
  }

  private signQrToken(ticketId: string, terminId: string, nonce: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(`${ticketId}:${terminId}:${nonce}`)
      .digest('base64url');
  }
}
