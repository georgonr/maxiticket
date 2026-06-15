import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PaymentGatewayService } from './payment-gateways.service';
import { SetActiveGatewayDto } from './dto/set-active-gateway.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

// Úloha 25: SUPERADMIN/STAFF správa aktívnej platobnej brány.
@Controller('admin/payment-gateways')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.STAFF)
export class PaymentGatewaysController {
  constructor(private readonly svc: PaymentGatewayService) {}

  @Get()
  list() {
    return this.svc.listGateways();
  }

  @Put('active')
  setActive(@Body() dto: SetActiveGatewayDto, @CurrentUser() user: JwtPayload) {
    return this.svc.setActiveGateway(dto.gateway, user.sub);
  }
}
