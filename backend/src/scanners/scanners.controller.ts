import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ScannersService } from './scanners.service';
import { CreateScannerDto } from './dto/create-scanner.dto';
import { UpdateScannerDto } from './dto/update-scanner.dto';
import { ChangeScannerPasswordDto } from './dto/change-scanner-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

@Controller('organizer/scanners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER_OWNER, UserRole.SUPERADMIN, UserRole.STAFF)
export class ScannersController {
  constructor(private readonly svc: ScannersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateScannerDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create(dto, user);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('organizerId') organizerId?: string) {
    return this.svc.list(user, organizerId);
  }

  @Patch(':id')
  setActive(
    @Param('id') id: string,
    @Body() dto: UpdateScannerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.setActive(id, dto, user);
  }

  // Úloha 23: zmena hesla scanner účtu (OWNER+SUPERADMIN+STAFF; MEMBER 403 cez @Roles triedy).
  @Patch(':id/password')
  setPassword(
    @Param('id') id: string,
    @Body() dto: ChangeScannerPasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.setPassword(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.remove(id, user);
  }
}
