import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { OrderStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersQueryService } from '../orders/orders-query.service';
import { OrdersService } from '../orders/orders.service';
import { VerifyService } from './verify.service';
import { LlmToolDef } from './llm/llm.types';

export interface ToolResult {
  summary: unknown; // čo dostane LLM (kompaktné, žiadne ťažké dáta)
  attachments?: { type: 'qr' | 'pdf'; [k: string]: unknown }[]; // priamo pre frontend (mimo LLM kontextu)
}

/**
 * Krok 28: nástroje asistenta. KAŽDÝ berie userId zo SESSION (nikdy z LLM argumentov).
 * orderRef/ticketId z LLM sa vždy overí proti userId – cudzie dáta sú neprístupné.
 */
@Injectable()
export class AssistantToolsService {
  private readonly logger = new Logger(AssistantToolsService.name);

  constructor(
    private prisma: PrismaService,
    private ordersQuery: OrdersQueryService,
    private orders: OrdersService,
    private verify: VerifyService,
  ) {}

  /** Definície nástrojov pre LLM (JSON Schema). userId NIE je parameter – dopĺňa ho backend. */
  toolDefs(): LlmToolDef[] {
    return [
      {
        name: 'findMyOrders',
        description: 'Vráti zoznam objednávok prihláseného používateľa (číslo, podujatie, termín, stav).',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'getOrderDetail',
        description: 'Detail jednej objednávky používateľa vrátane e-mailu, kam boli lístky poslané, a stavu lístkov.',
        parameters: {
          type: 'object',
          properties: { orderRef: { type: 'string', description: 'Číslo objednávky (napr. MT-2026-00001) alebo jej ID.' } },
          required: ['orderRef'], additionalProperties: false,
        },
      },
      {
        name: 'resendTicketEmail',
        description: 'Znova pošle vstupenky e-mailom NA E-MAIL Z OBJEDNÁVKY používateľa (nie na inú adresu).',
        parameters: {
          type: 'object',
          properties: { orderRef: { type: 'string', description: 'Číslo objednávky alebo jej ID.' } },
          required: ['orderRef'], additionalProperties: false,
        },
      },
      {
        name: 'getTicketQR',
        description: 'Vráti QR kódy platných vstupeniek objednávky (na zobrazenie v chate).',
        parameters: {
          type: 'object',
          properties: { orderRef: { type: 'string', description: 'Číslo objednávky alebo jej ID.' } },
          required: ['orderRef'], additionalProperties: false,
        },
      },
      {
        name: 'getTicketPdfLink',
        description: 'Vráti odkaz na PDF doklad/vstupenku objednávky (na stiahnutie).',
        parameters: {
          type: 'object',
          properties: { orderRef: { type: 'string', description: 'Číslo objednávky alebo jej ID.' } },
          required: ['orderRef'], additionalProperties: false,
        },
      },
    ];
  }

  /** Nájde objednávku používateľa podľa čísla ALEBO id; len ak patrí userId. */
  private async resolveOwnOrder(userId: string, orderRef: string) {
    const ref = (orderRef ?? '').trim();
    if (!ref) return null;
    return this.prisma.order.findFirst({
      where: { userId, OR: [{ id: ref }, { orderNumber: ref }] },
      select: { id: true, orderNumber: true, status: true, buyerEmail: true },
    });
  }

  private maskEmail(email: string): string {
    const [u, d] = email.split('@');
    if (!d) return email;
    const head = u.length <= 2 ? u[0] ?? '' : u.slice(0, 2);
    return `${head}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`;
  }

  async dispatch(name: string, args: Record<string, any>, userId: string): Promise<ToolResult> {
    switch (name) {
      case 'findMyOrders':
        return this.findMyOrders(userId);
      case 'getOrderDetail':
        return this.getOrderDetail(userId, args?.orderRef);
      case 'resendTicketEmail':
        return this.resendTicketEmail(userId, args?.orderRef);
      case 'getTicketQR':
        return this.getTicketQR(userId, args?.orderRef);
      case 'getTicketPdfLink':
        return this.getTicketPdfLink(userId, args?.orderRef);
      default:
        return { summary: { error: `Neznámy nástroj: ${name}` } };
    }
  }

  private async findMyOrders(userId: string): Promise<ToolResult> {
    const data = await this.ordersQuery.accountList(userId, { limit: 20, offset: 0 });
    const items = (data as any).items ?? data;
    const orders = (Array.isArray(items) ? items : []).map((o: any) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      showTitle: o.showTitle ?? o.items?.[0]?.showTitle ?? null,
      terminStartsAt: o.terminStartsAt ?? o.items?.[0]?.terminStartsAt ?? null,
      totalAmount: o.totalAmount,
      currency: o.currency,
    }));
    return { summary: { count: orders.length, orders } };
  }

  private async getOrderDetail(userId: string, orderRef: string): Promise<ToolResult> {
    const own = await this.resolveOwnOrder(userId, orderRef);
    if (!own) return { summary: { error: 'Objednávka sa nenašla alebo nepatrí vám.' } };
    const d = await this.ordersQuery.accountDetail(own.id, userId);
    return {
      summary: {
        orderNumber: d.orderNumber,
        status: d.status,
        sentToEmail: this.maskEmail(d.buyerEmail),
        totalAmount: d.totalAmount,
        currency: d.currency,
        items: d.items,
        tickets: d.tickets.map((t: any) => ({ maskedCode: t.maskedCode, status: t.status })),
        canRequestRefund: d.canRequestRefund,
      },
    };
  }

  private async resendTicketEmail(userId: string, orderRef: string): Promise<ToolResult> {
    const own = await this.resolveOwnOrder(userId, orderRef);
    if (!own) return { summary: { error: 'Objednávka sa nenašla alebo nepatrí vám.' } };
    if (own.status !== OrderStatus.PAID) {
      return { summary: { error: `Lístky sa dajú poslať len pre zaplatenú objednávku (stav: ${own.status}).` } };
    }
    await this.orders.resendTickets(own.id); // pošle na buyerEmail z objednávky (reálny SMTP)
    return { summary: { ok: true, sentToEmail: this.maskEmail(own.buyerEmail), orderNumber: own.orderNumber } };
  }

  private async getTicketQR(userId: string, orderRef: string): Promise<ToolResult> {
    const own = await this.resolveOwnOrder(userId, orderRef);
    if (!own) return { summary: { error: 'Objednávka sa nenašla alebo nepatrí vám.' } };
    const tickets = await this.prisma.ticket.findMany({
      where: { orderId: own.id, order: { userId }, status: TicketStatus.VALID },
      select: { id: true, qrToken: true, seatSection: true, seatRow: true, seatNumber: true },
      take: 6,
    });
    if (tickets.length === 0) return { summary: { error: 'Pre túto objednávku nie sú platné vstupenky.' } };
    const items = await Promise.all(
      tickets.map(async (t) => ({
        ticketId: t.id,
        label: [t.seatSection, t.seatRow, t.seatNumber].filter(Boolean).join(' ') || '…' + t.id.slice(-4).toUpperCase(),
        dataUrl: await QRCode.toDataURL(t.qrToken, { width: 240, margin: 2 }),
      })),
    );
    return {
      summary: { ticketCount: items.length, note: 'QR kódy boli priložené do chatu.' },
      attachments: [{ type: 'qr', orderNumber: own.orderNumber, items }],
    };
  }

  private async getTicketPdfLink(userId: string, orderRef: string): Promise<ToolResult> {
    const own = await this.resolveOwnOrder(userId, orderRef);
    if (!own) return { summary: { error: 'Objednávka sa nenašla alebo nepatrí vám.' } };
    if (own.status !== OrderStatus.PAID) {
      return { summary: { error: `PDF doklad je dostupný len pre zaplatenú objednávku (stav: ${own.status}).` } };
    }
    const url = `/v1/account/orders/${own.id}/receipt.pdf`;
    return {
      summary: { available: true, note: 'Odkaz na PDF bol priložený do chatu.' },
      attachments: [{ type: 'pdf', url, orderNumber: own.orderNumber, label: `Doklad ${own.orderNumber} (PDF)` }],
    };
  }

  // ─────────────────────── GUEST (neprihlásený) – fáza 2A ───────────────────────
  // Scoping NIE je userId, ale verifiedOrderId zo server-side Redisu (cez chatSessionId).
  // Pred overením je povolený LEN verifyIdentity; ostatné nástroje ignorujú akýkoľvek
  // order-ref z LLM a operujú výhradne na verifiedOrderId.

  /** Definície nástrojov pre GUEST agenta. */
  guestToolDefs(): LlmToolDef[] {
    return [
      {
        name: 'verifyIdentity',
        description:
          'Overí totožnosť zákazníka. Vyžaduje posledné 4 čísla platobnej karty A JEDEN identifikátor: e-mail, číslo objednávky (napr. MT-2026-00001) alebo číslo platby. Musí sa zavolať PRED akoukoľvek inou akciou.',
        parameters: {
          type: 'object',
          properties: {
            last4: { type: 'string', description: 'Posledné 4 čísla platobnej karty (presne 4 číslice).' },
            identifier: { type: 'string', description: 'E-mail ALEBO číslo objednávky ALEBO číslo platby z objednávky.' },
          },
          required: ['last4', 'identifier'],
          additionalProperties: false,
        },
      },
      {
        name: 'getOrderInfo',
        description: 'Detail overenej objednávky (podujatie, termín, miesto, dátum, stav, lístky). Vyžaduje predošlé overenie.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'resendTicketToOriginalEmail',
        description: 'Znova pošle vstupenky NA PÔVODNÝ e-mail z objednávky. Nikdy na iný e-mail. Vyžaduje predošlé overenie.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'getTicketQR',
        description: 'Vráti QR kódy platných vstupeniek overenej objednávky (do chatu). Vyžaduje predošlé overenie.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'escalateToAdmin',
        description:
          'Eskaluje na ľudskú podporu (napr. keď zákazník chce lístok na INÝ e-mail, alebo sa nedá overiť kartou). Nepošle nič sám – len informuje podporu.',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Krátky dôvod eskalácie.' },
            desiredEmail: { type: 'string', description: 'Voliteľný nový e-mail, ktorý zákazník žiada.' },
          },
          required: ['reason'],
          additionalProperties: false,
        },
      },
    ];
  }

  async dispatchGuest(name: string, args: Record<string, any>, chatSessionId: string): Promise<ToolResult> {
    if (name === 'verifyIdentity') {
      return this.guestVerifyIdentity(args?.last4, args?.identifier, chatSessionId);
    }
    // Všetky ostatné nástroje sú gate-nuté na verifiedOrderId z Redisu (nie z LLM).
    const orderId = await this.verify.getVerifiedOrderId(chatSessionId);
    if (!orderId) {
      return { summary: { error: 'Najprv treba overiť totožnosť (posledné 4 čísla karty + e-mail/číslo objednávky/číslo platby).' } };
    }
    switch (name) {
      case 'getOrderInfo':
        return this.guestOrderInfo(orderId);
      case 'resendTicketToOriginalEmail':
        return this.guestResend(orderId);
      case 'getTicketQR':
        return this.guestTicketQR(orderId);
      case 'escalateToAdmin':
        return this.guestEscalate(orderId, args?.reason, args?.desiredEmail);
      default:
        return { summary: { error: `Neznámy nástroj: ${name}` } };
    }
  }

  private async guestVerifyIdentity(last4: string, identifier: string, chatSessionId: string): Promise<ToolResult> {
    const { status } = await this.verify.verify(String(last4 ?? ''), String(identifier ?? ''), chatSessionId);
    switch (status) {
      case 'VERIFIED':
        return { summary: { verified: true } };
      case 'LOCKED':
        return { summary: { verified: false, reason: 'LOCKED', message: 'Príliš veľa neúspešných pokusov. Skús to neskôr alebo požiadaj o eskaláciu na podporu.' } };
      case 'NEEDS_ESCALATION':
        return { summary: { verified: false, reason: 'NEEDS_ESCALATION', message: 'Túto objednávku sa nedá overiť kartou. Ponúkni eskaláciu na ľudskú podporu (escalateToAdmin).' } };
      case 'AMBIGUOUS':
        return { summary: { verified: false, reason: 'AMBIGUOUS', message: 'Nájdených viac objednávok. Vyžiadaj číslo objednávky (MT-…) na jednoznačné overenie.' } };
      default:
        return { summary: { verified: false, reason: 'FAILED', message: 'Overenie neúspešné. Skontroluj údaje a skús znova.' } };
    }
  }

  private async guestOrderInfo(orderId: string): Promise<ToolResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            termin: { include: { show: true, venue: true } },
            ticketType: true,
            terminSection: { include: { section: true } },
          },
        },
        tickets: { select: { id: true, status: true } },
      },
    });
    if (!order) return { summary: { error: 'Objednávka sa nenašla.' } };
    const termin = order.items[0]?.termin;
    return {
      summary: {
        orderNumber: order.orderNumber,
        status: order.status,
        sentToEmail: this.maskEmail(order.buyerEmail),
        show: termin?.show?.name ?? null,
        startsAt: termin?.startsAt ?? null,
        venue: termin?.venue?.name ?? null,
        city: termin?.venue?.city ?? null,
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
        items: order.items.map((i) => ({ name: i.ticketType?.name ?? i.terminSection?.section?.name ?? '—', quantity: i.quantity })),
        tickets: order.tickets.map((t) => ({ status: t.status })),
      },
    };
  }

  private async guestResend(orderId: string): Promise<ToolResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true, buyerEmail: true, orderNumber: true } });
    if (!order) return { summary: { error: 'Objednávka sa nenašla.' } };
    if (order.status !== OrderStatus.PAID) {
      return { summary: { error: `Lístky sa dajú poslať len pre zaplatenú objednávku (stav: ${order.status}).` } };
    }
    await this.orders.resendTickets(orderId); // posiela LEN na buyerEmail objednávky
    return { summary: { ok: true, sentToEmail: this.maskEmail(order.buyerEmail), orderNumber: order.orderNumber } };
  }

  private async guestTicketQR(orderId: string): Promise<ToolResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
    const tickets = await this.prisma.ticket.findMany({
      where: { orderId, status: TicketStatus.VALID },
      select: { id: true, qrToken: true, seatSection: true, seatRow: true, seatNumber: true },
      take: 6,
    });
    if (tickets.length === 0) return { summary: { error: 'Pre túto objednávku nie sú platné vstupenky.' } };
    const items = await Promise.all(
      tickets.map(async (t) => ({
        ticketId: t.id,
        label: [t.seatSection, t.seatRow, t.seatNumber].filter(Boolean).join(' ') || '…' + t.id.slice(-4).toUpperCase(),
        dataUrl: await QRCode.toDataURL(t.qrToken, { width: 240, margin: 2 }),
      })),
    );
    return {
      summary: { ticketCount: items.length, note: 'QR kódy boli priložené do chatu.' },
      attachments: [{ type: 'qr', orderNumber: order?.orderNumber, items }],
    };
  }

  private async guestEscalate(orderId: string, reason: string, desiredEmail?: string): Promise<ToolResult> {
    // Fáza 2A: len záznam do logu (plný admin surface = fáza 3). Nikdy neposiela na iný e-mail.
    this.logger.warn(
      `[ESKALÁCIA podpora] order=${orderId} reason="${(reason ?? '').slice(0, 200)}"` +
        (desiredEmail ? ` desiredEmail="${this.maskEmail(String(desiredEmail))}"` : ''),
    );
    return { summary: { ok: true, note: 'Požiadavka bola odovzdaná ľudskej podpore. Ozvú sa ti čo najskôr.' } };
  }
}
