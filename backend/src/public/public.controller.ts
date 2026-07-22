import { Controller, Get, Post, Param, Query, Body, HttpCode, Ip, Headers, Res, GoneException, NotFoundException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { PublicService } from './public.service';
import { PlatformInfoService } from '../platform-info/platform-info.service';
import { ContactDto } from './contact.dto';
import { QrCheckoutDto } from './qr-checkout.dto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { buildTicketEmailData } from '../orders/orders-mail.helper';
import { verifyGuestTicketToken, guestTicketSecret } from '../orders/guest-ticket-token';

@Controller('public')
export class PublicController {
  constructor(
    private readonly svc: PublicService,
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly platformInfo: PlatformInfoService,
  ) {}

  /**
   * Identifikačné údaje prevádzkovateľa pre /gdpr a /kontakt. Len na čítanie,
   * bez autentifikácie – sú to údaje, ktoré musia byť na webe zverejnené.
   * Zdroj je PlatformInfo, aby web, faktúry aj vstupenky hovorili to isté.
   */
  @Get('platform-info')
  platformInfoPublic() {
    return this.platformInfo.getPublic();
  }

  // Guest ticket: token → orderId (410 ak neplatný/expirovaný).
  private orderIdFromToken(token: string): string {
    const secret = guestTicketSecret(
      this.config.get<string>('QR_HMAC_SECRET'),
      this.config.get<string>('JWT_SECRET'),
    );
    const res = verifyGuestTicketToken(token, secret);
    if (!res) throw new GoneException('Odkaz na lístok expiroval alebo je neplatný.');
    return res.orderId;
  }

  // Verejné zobrazenie lístkov objednávky cez 1h guest token (QR + info). 410 po expirácii.
  @Get('orders/by-token/:token')
  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  async ticketsByToken(@Param('token') token: string) {
    const orderId = this.orderIdFromToken(token);
    const data = await buildTicketEmailData(orderId, this.prisma);
    if (!data) throw new NotFoundException('Objednávka sa nenašla.');
    return {
      orderNumber: data.orderNumber,
      showName: data.showName,
      startsAt: data.startsAt,
      timezone: data.timezone,
      venueName: data.venueName,
      venueCity: data.venueCity ?? null,
      tickets: data.tickets.map((t) => ({ id: t.id, typeName: t.typeName, qrToken: t.qrToken })),
    };
  }

  // Verejné stiahnutie PDF jednej vstupenky cez 1h guest token (reuse e-mailový generátor).
  @Get('orders/by-token/:token/tickets/:ticketId/pdf')
  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  async ticketPdfByToken(
    @Param('token') token: string,
    @Param('ticketId') ticketId: string,
    @Res() res: FastifyReply,
  ) {
    const orderId = this.orderIdFromToken(token);
    const data = await buildTicketEmailData(orderId, this.prisma);
    if (!data) throw new NotFoundException('Objednávka sa nenašla.');
    const pdf = await this.mail.renderTicketPdf(data, ticketId);
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename="vstupenka-${ticketId.slice(-6).toUpperCase()}.pdf"`);
    res.send(pdf);
  }

  @Get('hero')
  getHero() {
    return this.svc.getHeroSlides();
  }

  @Get('shows')
  listShows(
    @Query('category') category?: string,
    @Query('date') dateFilter?: string,
    @Query('city') city?: string,
    @Query('q') search?: string,
  ) {
    return this.svc.listShows({ category, dateFilter, city, search });
  }

  // Krok 30: pool vybraných podujatí pre homepage (mix predané+najnovšie).
  @Get('featured-shows')
  featuredShows() {
    return this.svc.featuredShows();
  }

  @Get('filters')
  async getFilters() {
    const [categories, cities] = await Promise.all([
      this.svc.getCategories(),
      this.svc.getCities(),
    ]);
    return { categories, cities };
  }

  @Get('shows/:slug')
  getShow(@Param('slug') slug: string) {
    return this.svc.getShowBySlug(slug);
  }

  // Úloha 22/3b: sedadlá SEATED sekcií termínu so statusom (pre verejný seat-picker)
  @Get('termins/:terminId/seats')
  getTerminSeats(@Param('terminId') terminId: string) {
    return this.svc.getTerminSeats(terminId);
  }

  @Post('contact')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  contact(@Body() dto: ContactDto, @Ip() _ip: string) {
    return this.svc.sendContactEmail(dto);
  }

  // Krok 2/2: poplatok za spracovanie pre danú sumu (display v checkoute). Len suma.
  @Get('checkout/fee-quote')
  feeQuote(@Query('terminId') terminId: string, @Query('amount') amount?: string) {
    return this.svc.checkoutFeeQuote(terminId, Number(amount));
  }

  // ── QR rýchly nákup (scan-to-buy) ──
  @Get('qr/:ticketTypeId')
  qrInfo(@Param('ticketTypeId') ticketTypeId: string) {
    return this.svc.qrTicketInfo(ticketTypeId);
  }

  @Post('qr-checkout')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  qrCheckout(@Body() dto: QrCheckoutDto, @Headers('origin') origin?: string) {
    return this.orders.qrCheckout(dto, origin);
  }
}
