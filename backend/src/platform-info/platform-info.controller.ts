import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { PlatformInfoService } from './platform-info.service';
import { UpdatePlatformInfoDto } from './dto/update-platform-info.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/platform-info')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class PlatformInfoController {
  constructor(private readonly service: PlatformInfoService) {}

  @Get()
  getCurrent() {
    return this.service.getCurrent();
  }

  @Patch()
  updateCurrent(@Body() dto: UpdatePlatformInfoDto) {
    return this.service.updateCurrent(dto);
  }
}
