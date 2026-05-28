import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly svc: PublicService) {}

  @Get('shows')
  listShows(
    @Query('category') category?: string,
    @Query('date') dateFilter?: string,
    @Query('city') city?: string,
  ) {
    return this.svc.listShows({ category, dateFilter, city });
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
}
