import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { CurrentCompanyId } from '../common/decorators/company.decorator';
import { CreateInvoiceDto } from './dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class InvoicesController {
  constructor(private invoices: InvoicesService) {}

  @Post()
  create(@CurrentCompanyId() companyId: string, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(companyId, dto);
  }

  @Get()
  findAll(
    @CurrentCompanyId() companyId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.invoices.findAll(companyId, { status, type });
  }

  @Get(':id')
  findOne(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.invoices.findOne(companyId, id);
  }

  @Get(':id/xml')
  async getXml(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    const xml = await this.invoices.getXml(companyId, id);
    return { xml };
  }
}
