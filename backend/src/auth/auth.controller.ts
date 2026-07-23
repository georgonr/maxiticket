import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterOrganizerDto } from './dto/register.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { FastifyRequest } from 'fastify';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterOrganizerDto, @Req() req: FastifyRequest) {
    const ip = req.ip;
    const ua = req.headers['user-agent'];
    return this.authService.registerOrganizer(dto, ip, ua);
  }

  @Post('register-customer')
  @HttpCode(HttpStatus.CREATED)
  registerCustomer(@Body() dto: RegisterCustomerDto, @Req() req: FastifyRequest) {
    return this.authService.registerCustomer(dto, req.ip, req.headers['user-agent']);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Bez guardu: refresh token je opaque UUID, overuje sa v service proti DB.
  // (Predtým tu bol JwtRefreshGuard, ktorý UUID parsoval ako JWT a vždy odmietol.)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email, dto.locale);
    return { message: 'Ak účet existuje, e-mail bol odoslaný.' };
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Heslo bolo úspešne zmenené.' };
  }
}
