import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TicketTypesService } from './ticket-types.service';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/ticket-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';

@Controller('termins/:terminId/ticket-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketTypesController {
  constructor(private readonly svc: TicketTypesService) {}

  @Get()
  findAll(@Param('terminId') terminId: string) { return this.svc.findAll(terminId); }

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  create(@Param('terminId') terminId: string, @Body() dto: CreateTicketTypeDto, @CurrentUser() u: JwtPayload) {
    return this.svc.create(terminId, dto, u);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  update(@Param('terminId') terminId: string, @Param('id') id: string, @Body() dto: UpdateTicketTypeDto, @CurrentUser() u: JwtPayload) {
    return this.svc.update(terminId, id, dto, u);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER)
  remove(@Param('terminId') terminId: string, @Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.remove(terminId, id, u);
  }
}
