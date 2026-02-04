import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../../common/schemas/audit-log.schema';
import { DianHistory, DianHistorySchema } from '../../dian/schemas/dian-history.schema';
import { AuditService } from '../../common/services/audit.service';
import { DianAuditService } from './services/dian-audit.service';
import { AuditExportService } from './services/audit-export.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: DianHistory.name, schema: DianHistorySchema },
    ]),
  ],
  providers: [AuditService, DianAuditService, AuditExportService],
  controllers: [AuditController],
  exports: [AuditService, DianAuditService],
})
export class AuditModule {}
