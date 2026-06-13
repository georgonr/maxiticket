import {
  Controller, Get, Post, Patch, Param, Query, Body, Res, UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AccountService } from './account.service';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { OrdersQueryService } from '../orders/orders-query.service';
import { RefundsService } from '../refunds/refunds.service';
import { RequestRefundDto } from '../refunds/dto/request-refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

/**
 * Zákaznícke konto – každý prihlásený používateľ vidí VÝHRADNE svoje vlastné
 * nákupy (scoped na JWT.sub / Order.userId). Bez RolesGuard – scoping cez userId.
 */
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly ordersQuery: OrdersQueryService,
    private readonly refunds: RefundsService,
  ) {}

  @Get('orders')
  orders(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ordersQuery.accountList(user.sub, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('orders/:id')
  order(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ordersQuery.accountDetail(id, user.sub);
  }

  @Post('orders/:id/refund-request')
  requestRefund(
    @Param('id') id: string,
    @Body() dto: RequestRefundDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.refunds.requestRefund(id, user.sub, dto.reason);
  }

  @Get('orders/:id/receipt.pdf')
  async receipt(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Res() res: FastifyReply) {
    const { pdf, filename } = await this.ordersQuery.accountReceiptPdf(id, user.sub);
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }

  @Get('profile')
  profile(@CurrentUser() user: JwtPayload) {
    return this.account.profile(user.sub);
  }

  @Patch('notifications')
  notifications(@Body() dto: UpdateNotificationsDto, @CurrentUser() user: JwtPayload) {
    return this.account.updateNotifications(user.sub, dto);
  }
}
