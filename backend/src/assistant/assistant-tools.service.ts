import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { OrderStatus, TicketStatus } from '@prisma/client';
import { qrOptions } from '../common/qr.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { OrdersQueryService } from '../orders/orders-query.service';
import { OrdersService } from '../orders/orders.service';
import { PublicService } from '../public/public.service';
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
    private publicSvc: PublicService,
    private config: ConfigService,
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
      this.publicEventsDef(),
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
      case 'getPublicEvents':
        return this.getPublicEvents(args);
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
        dataUrl: await QRCode.toDataURL(t.qrToken, qrOptions(240)),
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

  // ─────────────────── Verejné podujatia (guest AJ prihlásený) ───────────────────
  // Číta LEN verejne zverejnené podujatia cez PublicService.listShows (PUBLISHED +
  // budúci termín ON_SALE/COMING_SOON, visible). NIKDY nevracia DRAFT/ARCHIVED/skryté.

  private publicEventsDef(): LlmToolDef {
    return {
      name: 'getPublicEvents',
      description:
        'Vráti AKTUÁLNE zverejnené podujatia naživo z ponuky (názov, dátum najbližšieho termínu, miesto, kategória, cena od, odkaz na detail). Zobrazuje LEN verejné podujatia. Zavolaj keď sa používateľ pýta „aké máte akcie/podujatia/koncerty…".',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Voliteľný filter kategórie (Koncerty, Šport, Divadlo, Festivaly, Konferencie).' },
          city: { type: 'string', description: 'Voliteľný filter mesta.' },
          date: { type: 'string', enum: ['today', 'week', 'weekend'], description: 'Voliteľný filter dátumu.' },
        },
        additionalProperties: false,
      },
    };
  }

  private async getPublicEvents(args: Record<string, any>): Promise<ToolResult> {
    const shows = await this.publicSvc.listShows({
      category: args?.category || undefined,
      city: args?.city || undefined,
      dateFilter: args?.date || undefined,
    });
    const base = this.config.get<string>('APP_BASE_URL') ?? 'https://ticketall.eu';
    const events = shows.slice(0, 12).map((s: any) => {
      const t = s.termins?.[0];
      return {
        name: s.name,
        category: s.category ?? null,
        startsAt: t?.startsAt ?? null,
        venue: t?.venueName ?? null,
        city: t?.city ?? null,
        priceFrom: t?.minPrice ?? null,
        currency: t?.currency ?? 'EUR',
        link: `${base}/events/${s.slug}`,
      };
    });
    return { summary: { total: shows.length, shown: events.length, events } };
  }

  // ─────────────────── GUEST (neprihlásený) – infobot ───────────────────
  // Guest NEMÁ prístup k osobným dátam (objednávky/lístky). Jediný dátový nástroj je
  // getPublicEvents. Osobné akcie (stratený lístok) → agent navedie prihlásiť sa.

  guestToolDefs(): LlmToolDef[] {
    return [this.publicEventsDef()];
  }

  async dispatchGuest(name: string, args: Record<string, any>, _chatSessionId: string): Promise<ToolResult> {
    switch (name) {
      case 'getPublicEvents':
        return this.getPublicEvents(args);
      default:
        return { summary: { error: 'Táto akcia vyžaduje prihlásenie. Pre prácu s tvojimi lístkami sa prosím prihlás.' } };
    }
  }
}
