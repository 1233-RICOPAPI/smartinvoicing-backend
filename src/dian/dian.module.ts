import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DianService } from './dian.service';
import { DianConfigService } from './dian-config.service';
import { DianController } from './dian.controller';
import { QrService } from './qr/qr.service';
import { SignerService } from './signer/signer.service';
import { DianApiService } from './api/dian-api.service';
import { DianResolutionService } from './resolution/dian-resolution.service';
import { PdfGeneratorService } from './pdf/pdf-generator.service';
import { PosInvoiceService } from './pos-invoice/pos-invoice.service';
import { DianResponseHandler } from './handlers/dian-response.handler';
import { FacturaStatusTracker } from './tracker/factura-status.tracker';
import { DianHistory, DianHistorySchema } from './schemas/dian-history.schema';
import { InvoicingModule } from '../modules/invoicing/invoicing.module';
import { AuditModule } from '../modules/audit/audit.module';

@Module({
  imports: [
    InvoicingModule,
    AuditModule,
    MongooseModule.forFeature([{ name: DianHistory.name, schema: DianHistorySchema }]),
  ],
  providers: [
    DianConfigService,
    DianService,
    QrService,
    SignerService,
    DianApiService,
    DianResolutionService,
    PdfGeneratorService,
    PosInvoiceService,
    DianResponseHandler,
    FacturaStatusTracker,
  ],
  controllers: [DianController],
  exports: [
    DianService,
    QrService,
    SignerService,
    DianApiService,
    DianResolutionService,
    PdfGeneratorService,
    PosInvoiceService,
    DianResponseHandler,
    FacturaStatusTracker,
  ],
})
export class DianModule {}
