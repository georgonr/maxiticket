import { Module } from '@nestjs/common';
import { PlatformInfoService } from './platform-info.service';
import { PlatformInfoController } from './platform-info.controller';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [CaslModule],
  controllers: [PlatformInfoController],
  providers: [PlatformInfoService],
  exports: [PlatformInfoService],
})
export class PlatformInfoModule {}
