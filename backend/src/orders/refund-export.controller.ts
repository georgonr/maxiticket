import { Controller, Get, Post, Param, Query, Res, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import { RefundExportService } from './refund-export.service';
import { EventCancelService } from './event-cancel.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

// Úloha 26: CSV export platieb na refund. Len ADMIN/STAFF + ORGANIZER (vlastník); CUSTOMER/SCANNER NIE.
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
export class RefundExportController {
  constructor(
    private readonly svc: RefundExportService,
    private readonly cancelSvc: EventCancelService,
  ) {}

  // Krok 27: zrušenie jedného termínu (occurrence). 409 ak už zrušený.
  @Post(':eventId/occurrences/:occurrenceId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOccurrence(
    @Param('eventId') eventId: string,
    @Param('occurrenceId') occurrenceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.cancelSvc.cancelOccurrence(eventId, occurrenceId, user);
  }

  @Get(':eventId/refund-export')
  async exportRefunds(
    @Param('eventId') eventId: string,
    @Query('occurrenceId') occurrenceId: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res() res: FastifyReply,
  ) {
    const { filename, csv } = await this.svc.exportCsv(eventId, occurrenceId, user);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
