import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ScanService } from './scan.service';
import { ValidateScanDto } from './dto/scan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';

@Controller('scan')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveUserGuard)
@Roles(
  UserRole.SUPERADMIN,
  UserRole.STAFF,
  UserRole.ORGANIZER_OWNER,
  UserRole.ORGANIZER_MEMBER,
  UserRole.SCANNER,
)
// Door scanning NESMIE byť rate-limitované – na plnej sále (viac liniek za jednou
// IP miesta) by throttle blokoval vstup. Autentizované (SCANNER rola), nízke riziko.
@SkipThrottle()
export class ScanController {
  constructor(private readonly svc: ScanService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(
    @Body() dto: ValidateScanDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.svc.validateScan(dto.qrToken, dto.terminId, user, ip);
  }

  @Get('terminy')
  getTerminy(
    @CurrentUser() user: JwtPayload,
    @Query('showAll') showAll?: string,
  ) {
    return this.svc.getTerminy(user, showAll === 'true');
  }
}
