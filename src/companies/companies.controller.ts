import { Controller, Get, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/company.decorator';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private companies: CompaniesService) {}

  @Get('me')
  me(@CurrentCompanyId() companyId: string) {
    return this.companies.findOne(companyId);
  }
}
