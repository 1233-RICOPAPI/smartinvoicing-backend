import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/company.decorator';
import { CreateClientDto, UpdateClientDto } from './dto';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private clients: ClientsService) {}

  @Post()
  create(@CurrentCompanyId() companyId: string, @Body() dto: CreateClientDto) {
    return this.clients.create(companyId, dto);
  }

  @Get()
  findAll(@CurrentCompanyId() companyId: string) {
    return this.clients.findAll(companyId);
  }

  @Get(':id')
  findOne(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.clients.findOne(companyId, id);
  }

  @Put(':id')
  update(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(companyId, id, dto);
  }
}
