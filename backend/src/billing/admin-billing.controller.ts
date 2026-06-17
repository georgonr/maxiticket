import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, Res,
  BadRequestException, UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { UserRole, InvoiceStatus } from '@prisma/client';
import { BillingService } from './billing.service';
import { InvoiceService } from './invoice.service';
import { BillingSchedulerService, AutoGenMode } from './billing-scheduler.service';
import { CreateInvoiceDto, AddLineItemDto, UpdateLineItemDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

/**
 * Fakturačný systém (krok 13a) – read-only super-admin prehľad výpočtu.
 * Guard: SUPERADMIN aj STAFF (ostatné role 403). Žiadne PDF/automatizácia.
 */
@Controller('admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.STAFF)
export class AdminBillingController {
  constructor(
    private readonly svc: BillingService,
    private readonly invoices: InvoiceService,
    private readonly scheduler: BillingSchedulerService,
  ) {}

  // ─────────────────────── AUTOMATIZÁCIA (krok 13c) ───────────────────────

  /** Manuálny spúšťač cron logiky (test + ops). LEN SUPERADMIN. */
  @Post('run-auto-generation')
  @Roles(UserRole.SUPERADMIN)
  runAutoGeneration(@Query('mode') mode?: string) {
    const m: AutoGenMode = mode === 'per_event' || mode === 'monthly' ? mode : 'all';
    return this.scheduler.runAuto(m);
  }

  // ─────────────────────── FAKTÚRY (krok 13b) ───────────────────────

  @Post('organizers/:id/invoices')
  createInvoice(@Param('id') id: string, @Body() dto: CreateInvoiceDto, @CurrentUser() user: JwtPayload) {
    if (dto.occurrenceId) {
      return this.invoices.createDraft(id, { occurrenceId: dto.occurrenceId }, user.sub);
    }
    if (dto.from && dto.to) {
      const f = new Date(dto.from); const t = new Date(dto.to);
      if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) throw new BadRequestException('Neplatný rozsah.');
      return this.invoices.createDraft(id, { from: f, to: t }, user.sub);
    }
    throw new BadRequestException('Zadajte occurrenceId alebo from+to.');
  }

  @Get('invoices')
  listInvoices(@Query('organizerId') organizerId?: string, @Query('status') status?: string) {
    const valid = ['DRAFT', 'FINALIZED', 'SENT', 'PAID'];
    const st = status && valid.includes(status) ? (status as InvoiceStatus) : undefined;
    return this.invoices.list({ organizerId, status: st });
  }

  @Get('invoices/:invId')
  getInvoice(@Param('invId') invId: string) {
    return this.invoices.get(invId);
  }

  @Post('invoices/:invId/line-items')
  addLineItem(@Param('invId') invId: string, @Body() dto: AddLineItemDto) {
    return this.invoices.addLineItem(invId, dto);
  }

  @Patch('invoices/:invId/line-items/:lineId')
  updateLineItem(@Param('invId') invId: string, @Param('lineId') lineId: string, @Body() dto: UpdateLineItemDto) {
    return this.invoices.updateLineItem(invId, lineId, dto);
  }

  @Delete('invoices/:invId/line-items/:lineId')
  deleteLineItem(@Param('invId') invId: string, @Param('lineId') lineId: string) {
    return this.invoices.deleteLineItem(invId, lineId);
  }

  @Patch('invoices/:invId')
  updateInvoice(@Param('invId') invId: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.updateInvoice(invId, dto);
  }

  @Post('invoices/:invId/finalize')
  finalizeInvoice(@Param('invId') invId: string) {
    return this.invoices.finalize(invId);
  }

  @Post('invoices/:invId/send')
  sendInvoice(@Param('invId') invId: string) {
    return this.invoices.send(invId);
  }

  @Post('invoices/:invId/mark-paid')
  markPaid(@Param('invId') invId: string) {
    return this.invoices.markPaid(invId);
  }

  @Post('invoices/:invId/mark-paid-out')
  markPaidOut(@Param('invId') invId: string) {
    return this.invoices.markPaidOut(invId);
  }

  @Delete('invoices/:invId')
  deleteInvoice(@Param('invId') invId: string) {
    return this.invoices.deleteInvoice(invId);
  }

  @Get('invoices/:invId/pdf')
  async invoicePdf(@Param('invId') invId: string, @Res() reply: FastifyReply) {
    const { pdf, filename } = await this.invoices.invoicePdf(invId);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.send(pdf);
  }

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
