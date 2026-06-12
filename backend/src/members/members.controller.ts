import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

@Controller('organizer/members')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER_OWNER, UserRole.SUPERADMIN, UserRole.STAFF)
export class MembersController {
  constructor(private readonly svc: MembersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create(dto, user);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('organizerId') organizerId?: string) {
    return this.svc.list(user, organizerId);
  }

  @Patch(':id')
  setActive(@Param('id') id: string, @Body() dto: UpdateMemberDto, @CurrentUser() user: JwtPayload) {
    return this.svc.setActive(id, dto, user);
  }

  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.OK)
  resend(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.resendInvite(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.remove(id, user);
  }
}
