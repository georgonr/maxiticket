import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import { RefundExportService } from './refund-export.service';
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
  constructor(private readonly svc: RefundExportService) {}

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
