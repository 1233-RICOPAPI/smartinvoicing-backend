import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CompanyUserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';
import { CurrentUserId } from '../../common/decorators/user.decorator';
import { CopilotService } from './services/copilot.service';
import { CopilotQueryDto } from './dtos/copilot-query.dto';

@Controller('ai/copilot')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class AiController {
  constructor(private readonly copilot: CopilotService) {}

  /**
   * POST /ai/copilot/query
   * Pregunta en lenguaje natural (balance, resultados, IVA, retenciones, anomalías).
   * Solo roles AUDITOR y CONTADOR.
   */
  @Post('query')
  @UseGuards(RolesGuard)
  @Roles(CompanyUserRole.OWNER, CompanyUserRole.AUDITOR, CompanyUserRole.CONTADOR)
  async query(
    @CurrentCompanyId() companyId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CopilotQueryDto,
  ) {
    return this.copilot.query(companyId, userId, dto.query, dto.conversationId);
  }
}
