import { Controller, Get, Post, Param, Query, Body, HttpCode, Ip } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service';
import { ContactDto } from './contact.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly svc: PublicService) {}

  @Get('hero')
  getHero() {
    return this.svc.getHeroSlides();
  }

  @Get('shows')
  listShows(
    @Query('category') category?: string,
    @Query('date') dateFilter?: string,
    @Query('city') city?: string,
  ) {
    return this.svc.listShows({ category, dateFilter, city });
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
}
