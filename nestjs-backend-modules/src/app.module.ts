import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

import { FaqCategoryModule } from "@/modules/faq-category/faq-category.module";

import { AuditLogModule } from "./common/audit/audit-log.module";
import { CacheModule } from "./common/cache/cache.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { MailModule } from "./common/mail/mail.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import configuration from "./config/configuration";
import { AdminModule } from "./modules/admin/admin.module";
import { AdminBeneficiaryModule } from "./modules/admin-beneficiary/admin-beneficiary.module";
import { AdminStorageModule } from "./modules/admin-storage/admin-storage.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BeneficiaryModule } from "./modules/beneficiary/beneficiary.module";
import { CountryModule } from "./modules/country/country.module";
import { CurrencyModule } from "./modules/currency/currency.module";
import { FaqModule } from "./modules/faq/faq.module";
import { FxModule } from "./modules/fx/fx.module";
import { HealthModule } from "./modules/health/health.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { LandingContentModule } from "./modules/landing-content/landing-content.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { OtpModule } from "./modules/otp/otp.module";
import { PinModule } from "./modules/pin/pin.module";
import { PrefundingModule } from "./modules/prefunding/prefunding.module";
import { SiteConfigModule } from "./modules/site-config/site-config.module";
import { StaticFilesModule } from "./modules/static-files/static-files.module";
import { StorageModule } from "./modules/storage/storage.module";
import { TermsModule } from "./modules/terms/terms.module";
import { TransactionModule } from "./modules/transaction/transaction.module";
import { TransferModule } from "./modules/transfer/transfer.module";
import { TransferRateModule } from "./modules/transfer-rate/transfer-rate.module";
import { UserModule } from "./modules/user/user.module";
import { VersionModule } from "./modules/version/version.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    AuditLogModule,
    MailModule,
    OtpModule,
    TermsModule,
    TransferRateModule,
    AdminModule,
    AuthModule,
    BeneficiaryModule,
    UserModule,
    TransferModule,
    TransactionModule,
    CountryModule,
    CurrencyModule,
    KycModule,
    LandingContentModule,
    LedgerModule,
    StorageModule,
    AdminStorageModule,
    AdminBeneficiaryModule,
    HealthModule,
    VersionModule,
    StaticFilesModule,
    NotificationModule,
    FaqModule,
    FaqCategoryModule,
    PrefundingModule,
    PinModule,
    FxModule,
    SiteConfigModule,

  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
