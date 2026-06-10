import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { AdminMetricsController } from './admin-metrics.controller';
import { OrganizerMetricsController } from './organizer-metrics.controller';

// PrismaModule je @Global – netreba ho importovať explicitne.
@Module({
  controllers: [AdminMetricsController, OrganizerMetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
