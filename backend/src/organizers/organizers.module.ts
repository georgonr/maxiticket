import { Module } from '@nestjs/common';
import { OrganizersService } from './organizers.service';
import { OrganizersController, OrganizerBusinessController } from './organizers.controller';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [CaslModule],
  controllers: [OrganizersController, OrganizerBusinessController],
  providers: [OrganizersService],
  exports: [OrganizersService],
})
export class OrganizersModule {}
