import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/company.decorator';
import { CreateProductDto, UpdateProductDto } from './dto';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Post()
  create(@CurrentCompanyId() companyId: string, @Body() dto: CreateProductDto) {
    return this.products.create(companyId, dto);
  }

  @Get()
  findAll(@CurrentCompanyId() companyId: string) {
    return this.products.findAll(companyId);
  }

  @Get(':id')
  findOne(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.products.findOne(companyId, id);
  }

  @Put(':id')
  update(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(companyId, id, dto);
  }
}
