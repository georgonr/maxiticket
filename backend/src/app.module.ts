import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ResolveImageUrlsInterceptor } from './common/interceptors/resolve-image-urls.interceptor';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CaslModule } from './casl/casl.module';
import { OrganizersModule } from './organizers/organizers.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';
import { VenuesModule } from './venues/venues.module';
import { ShowsModule } from './shows/shows.module';
import { ShowImagesModule } from './show-images/show-images.module';
import { TerminsModule } from './termins/termins.module';
import { TicketTypesModule } from './ticket-types/ticket-types.module';
import { PublicModule } from './public/public.module';
import { MailModule } from './mail/mail.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AssistantModule } from './assistant/assistant.module';
import { HeroBannersModule } from './hero-banners/hero-banners.module';
import { ScanModule } from './scan/scan.module';
import { PlatformInfoModule } from './platform-info/platform-info.module';
import { MetricsModule } from './metrics/metrics.module';
import { BillingModule } from './billing/billing.module';
import { CouponsModule } from './coupons/coupons.module';
import { ScannersModule } from './scanners/scanners.module';
import { MembersModule } from './members/members.module';
import { AccountModule } from './account/account.module';
import { RefundsModule } from './refunds/refunds.module';
import { SeatmapsModule } from './seatmaps/seatmaps.module';
import { EkasaModule } from './ekasa/ekasa.module';
import { HealthController } from './health/health.controller';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    CaslModule,
    AuthModule,
    StorageModule,
    UploadsModule,
    OrganizersModule,
    UsersModule,
    VenuesModule,
    ShowsModule,
    ShowImagesModule,
    TerminsModule,
    TicketTypesModule,
    PublicModule,
    MailModule,
    OrdersModule,
    PaymentsModule,
    HeroBannersModule,
    ScanModule,
    PlatformInfoModule,
    MetricsModule,
    BillingModule,
    CouponsModule,
    ScannersModule,
    MembersModule,
    AccountModule,
    RefundsModule,
    SeatmapsModule,
    AssistantModule,
    EkasaModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResolveImageUrlsInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
