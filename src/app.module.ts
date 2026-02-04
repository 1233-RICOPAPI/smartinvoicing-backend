import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PrismaModule } from './common/prisma/prisma.module';
import { GuardsModule } from './common/guards/guards.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';
import { InvoicesModule } from './invoices/invoices.module';
import { DianModule } from './dian/dian.module';
import { InvoicingModule } from './modules/invoicing/invoicing.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SnapshotsModule } from './modules/snapshots/snapshots.module';
import { PosModule } from './modules/pos/pos.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ExportModule } from './modules/export/export.module';
import { AiModule } from './modules/ai/ai.module';
import { AuditModule } from './modules/audit/audit.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PlansModule } from './modules/plans/plans.module';
import { DeveloperModule } from './modules/developer/developer.module';

const skipMongo =
  process.env.SKIP_MONGODB === '1' || process.env.SKIP_MONGODB === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ...(skipMongo
      ? []
      : [
          MongooseModule.forRootAsync({
            useFactory: (config: ConfigService) => ({
              uri: config.get('MONGODB_URI', 'mongodb://localhost:27017/mottatech'),
              serverSelectionTimeoutMS: 10_000,
              retryWrites: false,
            }),
            inject: [ConfigService],
          }),
        ]),
    PrismaModule,
    GuardsModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    ClientsModule,
    ProductsModule,
    InvoicesModule,
    ...(skipMongo ? [] : [DianModule]),
    InvoicingModule,
    AccountingModule,
    ReportsModule,
    ...(skipMongo ? [] : [SnapshotsModule]),
    ...(skipMongo ? [] : [PosModule]),
    ...(skipMongo ? [] : [AnalyticsModule]),
    ...(skipMongo ? [] : [ExportModule]),
    ...(skipMongo ? [] : [AiModule]),
    ...(skipMongo ? [] : [AuditModule]),
    PaymentsModule,
    PlansModule,
    DeveloperModule,
  ],
})
export class AppModule {}
