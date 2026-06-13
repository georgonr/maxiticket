import { Module } from '@nestjs/common';
import { SeatmapsService } from './seatmaps.service';
import {
  VenueSeatmapsController,
  SeatmapsController,
  SectionsController,
} from './seatmaps.controller';
import { VenuesModule } from '../venues/venues.module';

@Module({
  imports: [VenuesModule],
  controllers: [
    VenueSeatmapsController,
    SeatmapsController,
    SectionsController,
  ],
  providers: [SeatmapsService],
})
export class SeatmapsModule {}
