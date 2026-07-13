import { Controller, Get, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TelegramService } from './telegram.service';
import { UpdateTelegramConfigDto } from './dto/update-telegram-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

// SUPERADMIN-only správa Telegram notifikácií (config + test). Organizátori nemajú prístup.
@Controller('admin/telegram')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class TelegramController {
  constructor(private readonly svc: TelegramService) {}

  /** Config pre admin UI – vracia chatId, enabled, tokenSet (NIE token). */
  @Get('config')
  getConfig() {
    return this.svc.getTelegramConfig();
  }

  /** Uloženie chatId/enabled (admin UI krok 4). */
  @Patch('config')
  setConfig(@Body() dto: UpdateTelegramConfigDto, @CurrentUser() user: JwtPayload) {
    return this.svc.setTelegramConfig(dto, user.sub);
  }

  /** Pošle testovaciu správu – overenie že Telegram funguje. */
  @Post('test')
  async test() {
    const sent = await this.svc.sendMessage('TicketAll Telegram test ✅');
    return { sent };
  }
}
