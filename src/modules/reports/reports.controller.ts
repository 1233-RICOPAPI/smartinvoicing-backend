import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BalanceReportService } from './services/balance-report.service';
import { IncomeStatementService } from './services/income-statement.service';
import { AuxiliaryLedgerService } from './services/auxiliary-ledger.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class ReportsController {
  constructor(
    private readonly balanceReport: BalanceReportService,
    private readonly incomeStatementService: IncomeStatementService,
    private readonly auxiliaryLedgerService: AuxiliaryLedgerService,
  ) {}

  /**
   * Balance General. GET /reports/balance?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  @Get('balance')
  async balance(
    @CurrentCompanyId() companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.balanceReport.generate(companyId, from, to);
  }

  /**
   * Estado de Resultados (P&G). GET /reports/income-statement?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  @Get('income-statement')
  async incomeStatement(
    @CurrentCompanyId() companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.incomeStatementService.generate(companyId, from, to);
  }

  /**
   * Libro auxiliar por cuenta. GET /reports/auxiliary-ledger?accountCode=130505&from=...&to=...
   * o POST con body { accountId?, accountCode?, from, to }
   */
  @Get('auxiliary-ledger')
  async auxiliaryLedger(
    @CurrentCompanyId() companyId: string,
    @Query('accountId') accountId?: string,
    @Query('accountCode') accountCode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from y to son obligatorios');
    }
    return this.auxiliaryLedgerService.generate(companyId, {
      accountId,
      accountCode,
      from,
      to,
    });
  }

}
