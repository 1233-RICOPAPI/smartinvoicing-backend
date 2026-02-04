import { Module } from '@nestjs/common';
import { AccountingEngineService } from './services/accounting-engine.service';
import { PucInitService } from './services/puc-init.service';
import { AccountingController } from './accounting.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [AccountingEngineService, PucInitService],
  controllers: [AccountingController],
  exports: [AccountingEngineService, PucInitService],
})
export class AccountingModule {}
