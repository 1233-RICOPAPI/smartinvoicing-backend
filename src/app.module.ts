import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

/**
 * URI de MongoDB desde env. En producción (Cloud Run) inyectar vía Secret Manager
 * como MONGO_URI o MONGODB_URI. Una sola conexión por instancia; Mongoose reutiliza el pool.
 */
function getMongoUri(): string {
  const uri =
    process.env.MONGO_URI?.trim() || process.env.MONGODB_URI?.trim() || '';
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !uri) {
    throw new Error(
      'MongoDB: MONGO_URI (o MONGODB_URI) es obligatoria en producción. Configúrela en Cloud Run (Secret Manager).',
    );
  }
  if (!uri && !isProduction) {
    return 'mongodb://localhost:27017/mottatech';
  }
  return uri;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // Una sola conexión al arranque; Mongoose reutiliza el pool. No abrir conexión por request:
    // evita latencia, agotamiento de conexiones en Atlas y no escala en Cloud Run (instancias efímeras).
    // Schemas: MongooseModule.forFeature() en cada módulo (ej. AiModule → copilot-cache.schema.ts).
    ...(skipMongo
      ? []
      : [
          MongooseModule.forRootAsync({
            useFactory: () => {
              const uri = getMongoUri();
              return {
                uri,
                serverSelectionTimeoutMS: 15_000,
                retryWrites: true,
                maxPoolSize: 10,
                minPoolSize: 1,
              };
            },
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
