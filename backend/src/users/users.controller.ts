import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateUserRoleDto, SetActiveDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // Defense-in-depth (krok 51, V7): explicitné @Roles na guard vrstve. Bez nich
  // RolesGuard pri chýbajúcich rolách vracia true → auth visela LEN na service vrstve
  // a akékoľvek nové DTO pole/refaktor by sa ticho stalo bypassom. Roly = superset
  // toho, čo service reálne pustí (platform + tenant); jemné scopovanie (assertAccessToUser,
  // canManageTarget) ostáva v service. CUSTOMER/ACCOUNTANT sú odrezaní už tu.
  @Get()
  @Roles(
    UserRole.SUPERADMIN, UserRole.STAFF, UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER, UserRole.SCANNER,
  )
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user);
  }

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPERADMIN, UserRole.STAFF, UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER, UserRole.SCANNER,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPERADMIN, UserRole.STAFF, UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER, UserRole.SCANNER,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  // Zmena role: len actori, ktorých service reálne pustí (canManageTarget / tenant owner).
  @Patch(':id/role')
  @Roles(UserRole.SUPERADMIN, UserRole.PLATFORM_ADMIN, UserRole.ORGANIZER_OWNER)
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateRole(id, dto, user);
  }

  /** Aktivácia / deaktivácia (guarded – canManageTarget strop). */
  @Patch(':id/active')
  @Roles(UserRole.SUPERADMIN, UserRole.PLATFORM_ADMIN)
  setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.setActive(id, dto.isActive, user);
  }

  /** Soft-delete = deaktivácia (isActive=false). */
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
