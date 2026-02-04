import { Module } from '@nestjs/common';
import { BalanceReportService } from './services/balance-report.service';
import { IncomeStatementService } from './services/income-statement.service';
import { AuxiliaryLedgerService } from './services/auxiliary-ledger.service';
import { ReportsController } from './reports.controller';

@Module({
  providers: [BalanceReportService, IncomeStatementService, AuxiliaryLedgerService],
  controllers: [ReportsController],
  exports: [BalanceReportService, IncomeStatementService, AuxiliaryLedgerService],
})
export class ReportsModule {}
