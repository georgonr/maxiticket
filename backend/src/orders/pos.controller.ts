import {
  Controller, Get, Post, Body, Param, Query, Res, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PosOrderDto } from './dto/pos-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

@Controller('organizer/pos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPERADMIN,
  UserRole.STAFF,
  UserRole.ORGANIZER_OWNER,
  UserRole.ORGANIZER_MEMBER,
)
export class PosController {
  constructor(private readonly svc: OrdersService) {}

  @Get('termins')
  termins(@CurrentUser() user: JwtPayload) {
    return this.svc.posTermins(user);
  }

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  createOrder(@Body() dto: PosOrderDto, @CurrentUser() user: JwtPayload) {
    return this.svc.posOrder(dto, user);
  }

  @Post('orders/:id/email')
  @HttpCode(HttpStatus.OK)
  emailTickets(
    @Param('id') id: string,
    @Body('email') email: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.posEmailTickets(id, email ?? '', user);
  }

  // ── Uzávierka (17-B) ──
  @Get('summary')
  summary(@CurrentUser() user: JwtPayload, @Query('organizerId') organizerId?: string) {
    return this.svc.posSummary(user, organizerId);
  }

  @Get('closures')
  closures(
    @CurrentUser() user: JwtPayload,
    @Query('organizerId') organizerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.posClosuresList(
      user,
      organizerId,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Post('closures')
  @HttpCode(HttpStatus.CREATED)
  createClosure(
    @CurrentUser() user: JwtPayload,
    @Body('note') note?: string,
    @Query('organizerId') organizerId?: string,
  ) {
    return this.svc.posCreateClosure(user, note, organizerId);
  }

  @Get('closures/:id/pdf')
  async closurePdf(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: FastifyReply,
  ) {
    const { pdf, filename } = await this.svc.posClosurePdf(id, user);
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }
}
