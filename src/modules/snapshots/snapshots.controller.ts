import { BadRequestException, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SnapshotGenerationService } from './services/snapshot-generation.service';
import { CloseMonthService } from './services/close-month.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';

@Controller('snapshots')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class SnapshotsController {
  constructor(
    private readonly snapshotGeneration: SnapshotGenerationService,
    private readonly closeMonth: CloseMonthService,
  ) {}

  @Post('monthly/:year/:month')
  async generate(
    @CurrentCompanyId() companyId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
      throw new BadRequestException('Año y mes inválidos');
    }
    return this.snapshotGeneration.generateMonthlySnapshot(companyId, y, m);
  }

  @Post('monthly/:year/:month/close')
  async close(
    @CurrentCompanyId() companyId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
      throw new BadRequestException('Año y mes inválidos');
    }
    return this.closeMonth.closeMonth(companyId, y, m);
  }

  @Get('monthly/:year/:month')
  async get(
    @CurrentCompanyId() companyId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m)) {
      throw new BadRequestException('Año y mes inválidos');
    }
    return this.snapshotGeneration.getSnapshot(companyId, y, m);
  }

  @Get('monthly/:year/:month/status')
  async status(
    @CurrentCompanyId() companyId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m)) {
      throw new BadRequestException('Año y mes inválidos');
    }
    return this.closeMonth.getStatus(companyId, y, m);
  }
}
