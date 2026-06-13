import {
  Controller, Get, Patch, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';
import { RefundsService } from './refunds.service';
import { ReviewRefundDto } from './dto/review-refund.dto';

/**
 * Organizer / SUPERADMIN správa žiadostí o vrátenie.
 * ORGANIZER_MEMBER zámerne NIE je v @Roles → 403 (member žiadosti nevidí ani nespracuje).
 */
@Controller('organizer/refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER_OWNER, UserRole.SUPERADMIN, UserRole.STAFF)
export class OrganizerRefundsController {
  constructor(private readonly refunds: RefundsService) {}

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  /** Organizer → scoped na vlastný org; super/staff → všetky orgy. */
  private scope(user: JwtPayload): string | undefined {
    return this.isSuperOrStaff(user) ? undefined : user.organizerId;
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.refunds.list(this.scope(user), status);
  }

  @Patch(':id')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewRefundDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.refunds.review(
      id, user.sub, this.scope(user), dto.action, dto.reviewNote, dto.refundAmount,
    );
  }

  @Patch(':id/mark-refunded')
  markRefunded(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.refunds.markRefunded(id, this.scope(user));
  }
}

/** Admin pohľad – všetky žiadosti naprieč organizátormi. */
@Controller('admin/refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.STAFF)
export class AdminRefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('organizerId') organizerId?: string) {
    return this.refunds.list(organizerId || undefined, status);
  }
}
