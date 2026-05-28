import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueDto, UpdateVenueDto } from './dto/venue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

@Controller('venues')
@UseGuards(JwtAuthGuard)
export class VenuesController {
  constructor(private readonly svc: VenuesService) {}

  @Get() findAll(@CurrentUser() u: JwtPayload) { return this.svc.findAll(u); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() u: JwtPayload) { return this.svc.findOne(id, u); }
  @Post() create(@Body() dto: CreateVenueDto, @CurrentUser() u: JwtPayload) { return this.svc.create(dto, u); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateVenueDto, @CurrentUser() u: JwtPayload) { return this.svc.update(id, dto, u); }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(@Param('id') id: string, @CurrentUser() u: JwtPayload) { return this.svc.remove(id, u); }
}
