import { Controller, Get, Param, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

/**
 * Fakturačný systém (krok 13a) – read-only super-admin prehľad výpočtu.
 * Guard: SUPERADMIN aj STAFF (ostatné role 403). Žiadne PDF/automatizácia.
 */
@Controller('admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.STAFF)
export class AdminBillingController {
  constructor(private readonly svc: BillingService) {}

  @Get('organizers')
  organizers() {
    return this.svc.organizersOverview();
  }

  @Get('organizers/:id/past-termins')
  pastTermins(@Param('id') id: string) {
    return this.svc.pastTermins(id);
  }

  @Get('organizers/:id/statement')
  statement(
    @Param('id') id: string,
    @Query('occurrenceId') occurrenceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (occurrenceId) {
      return this.svc.computeStatement(id, { occurrenceId });
    }
    if (from && to) {
      const fromD = new Date(from);
      const toD = new Date(to);
      if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
        throw new BadRequestException('Neplatný dátumový rozsah.');
      }
      return this.svc.computeStatement(id, { from: fromD, to: toD });
    }
    throw new BadRequestException('Zadajte occurrenceId alebo from+to.');
  }
}
