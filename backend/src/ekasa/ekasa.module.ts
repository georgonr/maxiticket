import { Module } from '@nestjs/common';
import { EkasaService } from './ekasa.service';
import { NineDigitEkasaProvider } from './ninedigit.provider';
import { EkasaAdminController } from './ekasa-admin.controller';

// PrismaModule je @Global. EkasaService exportujeme pre OrdersModule (POS hook).
@Module({
  controllers: [EkasaAdminController],
  providers: [EkasaService, NineDigitEkasaProvider],
  exports: [EkasaService],
})
export class EkasaModule {}
