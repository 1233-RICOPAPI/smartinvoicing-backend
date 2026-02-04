import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';
import { AnomalyDetectionService } from './services/anomaly-detection.service';
import { RiskScoringService } from './services/risk-scoring.service';
import { AccountingAnalyticsService } from './services/accounting-analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class AnalyticsController {
  constructor(
    private readonly anomaly: AnomalyDetectionService,
    private readonly risk: RiskScoringService,
    private readonly accounting: AccountingAnalyticsService,
  ) {}

  @Post('detect/invoice/:invoiceId')
  async runDetectionOnInvoice(
    @CurrentCompanyId() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: { userId?: string },
  ) {
    const ids = await this.anomaly.runOnInvoice({
      companyId,
      invoiceId,
      userId: body?.userId,
    });
    return { anomalyIds: ids };
  }

  @Get('anomalies')
  async listAnomalies(
    @CurrentCompanyId() companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const list = await this.anomaly.listByCompany(companyId, fromDate, toDate, {
      type,
      severity: severity as any,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { anomalies: list };
  }

  @Get('risk/user/:userId')
  async getUserRisk(
    @CurrentCompanyId() companyId: string,
    @Param('userId') userId: string,
  ) {
    const score = await this.risk.getLatestRiskScore(companyId, 'USER', userId);
    return score ?? { score: 0, entityType: 'USER', entityId: userId };
  }

  @Get('monthly-totals')
  async monthlyTotals(
    @CurrentCompanyId() companyId: string,
    @Query('yearStart') yearStart: string,
    @Query('yearEnd') yearEnd: string,
  ) {
    const start = parseInt(yearStart, 10) || new Date().getFullYear();
    const end = parseInt(yearEnd, 10) || start;
    return this.accounting.getMonthlyInvoiceTotals(companyId, start, end);
  }

  @Get('daily-counts')
  async dailyCounts(
    @CurrentCompanyId() companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    return this.accounting.getDailyInvoiceCounts(companyId, fromDate, toDate);
  }
}
