import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { BulkGenerateCouponsDto } from './dto/bulk-generate-coupons.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { RedeemCouponDto } from './dto/redeem-coupon.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly svc: CouponsService) {}

  // ── PUBLIC: validácia pre checkout (žiadny auth) ──
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@Body() dto: ValidateCouponDto) {
    return this.svc.validate(dto);
  }

  // ── Create single ──
  // Tvorbu smie robiť IBA organizátor pre vlastné podujatie (SHOW scope).
  // SUPERADMIN je zámerne vynechaný – nesmie vytvárať GLOBAL/organizer-wide kódy.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER_OWNER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCouponDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create(dto, user);
  }

  // ── Bulk generate ──
  // Rovnaké obmedzenie ako create – iba ORGANIZER_OWNER, len pre vlastné show.
  @Post('bulk-generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER_OWNER)
  @HttpCode(HttpStatus.OK)
  bulkGenerate(@Body() dto: BulkGenerateCouponsDto, @CurrentUser() user: JwtPayload) {
    return this.svc.bulkGenerate(dto, user);
  }

  // ── List ──
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ORGANIZER_OWNER)
  list(
    @CurrentUser() user: JwtPayload,
    @Query('scope') scope?: string,
    @Query('status') status?: string,
    @Query('organizerId') organizerId?: string,
    @Query('showId') showId?: string,
    @Query('relevantToShowId') relevantToShowId?: string,
    @Query('bulkBatchId') bulkBatchId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.list(user, {
      scope,
      status,
      organizerId,
      showId,
      relevantToShowId,
      bulkBatchId,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // ── Stats: predaj per kupón pre podujatie (C8 affiliate tracking) ──
  // POZOR: musí byť pred @Get(':id'), inak by 'stats' spadlo do :id.
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ORGANIZER_OWNER)
  stats(@CurrentUser() user: JwtPayload, @Query('showId') showId: string) {
    return this.svc.statsForShow(user, showId);
  }

  // ── Redeem (interne z order/checkout flow) ──
  @Post(':code/redeem')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  redeem(@Param('code') code: string, @Body() dto: RedeemCouponDto) {
    return this.svc.redeem(code, dto);
  }

  // ── Detail ──
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ORGANIZER_OWNER)
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.detail(id, user);
  }

  // ── Delete ──
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ORGANIZER_OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.remove(id, user);
  }
}
