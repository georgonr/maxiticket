import { Module } from '@nestjs/common';
import { TerminsService } from './termins.service';
import { TerminsController } from './termins.controller';
import { VenuesModule } from '../venues/venues.module';

@Module({
  imports: [VenuesModule],
  controllers: [TerminsController],
  providers: [TerminsService],
  exports: [TerminsService],
})
export class TerminsModule {}
