import {
  Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
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
}
