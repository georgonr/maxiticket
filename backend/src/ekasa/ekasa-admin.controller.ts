import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { EkasaService } from './ekasa.service';
import { CreateEkasaDeviceDto, UpdateEkasaDeviceDto } from './dto/ekasa-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

/**
 * Správa eKasa zariadení (ORP) per organizátor – LEN SUPERADMIN (accessToken = secret).
 * Token sa v odpovediach nevracia (len hasAccessToken).
 */
@Controller('admin/ekasa')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class EkasaAdminController {
  constructor(private readonly svc: EkasaService) {}

  @Get('devices')
  list(@Query('organizerId') organizerId?: string) {
    if (!organizerId) throw new BadRequestException('organizerId je povinný.');
    return this.svc.listDevices(organizerId);
  }

  @Post('devices')
  create(@Body() dto: CreateEkasaDeviceDto) {
    return this.svc.createDevice(dto);
  }

  @Patch('devices/:id')
  update(@Param('id') id: string, @Body() dto: UpdateEkasaDeviceDto) {
    return this.svc.updateDevice(id, dto);
  }

  @Delete('devices/:id')
  remove(@Param('id') id: string) {
    return this.svc.deleteDevice(id);
  }
}
