import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminConversationsService } from './admin-conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

// SUPERADMIN-only prehliadanie AI konverzácií (read-only). Organizátori nemajú prístup.
@Controller('admin/ai-conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AdminConversationsController {
  constructor(private readonly svc: AdminConversationsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('escalated') escalated?: string,
    @Query('channel') channel?: string,
    @Query('page') page?: string,
  ) {
    return this.svc.list({ status, escalated, channel, page });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(id);
  }
}
