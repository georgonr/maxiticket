import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { HelpdeskService } from './helpdesk.service';
import { ReplyDto, PatchTicketDto } from './dto/helpdesk.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

/** Helpdesk pre platformový support. Organizátori sem prístup nemajú. */
@Controller('admin/helpdesk')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.PLATFORM_ADMIN)
export class HelpdeskController {
  constructor(private readonly svc: HelpdeskService) {}

  @Get()
  list(@Query('status') status?: string, @Query('page') page?: string) {
    return this.svc.list({ status, page });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(id);
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.OK)
  reply(@Param('id') id: string, @Body() dto: ReplyDto, @CurrentUser() u: JwtPayload) {
    return this.svc.reply(id, dto.body, u.sub);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: PatchTicketDto) {
    return this.svc.patch(id, dto);
  }
}
