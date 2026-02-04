import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PosSaleService } from './services/pos-sale.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';
import { CurrentUserId } from '../../common/decorators/user.decorator';
import { RegisterPosSaleDto } from './dtos/register-pos-sale.dto';

@Controller('pos')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class PosController {
  constructor(private readonly posSale: PosSaleService) {}

  @Post('sale')
  async registerSale(
    @CurrentCompanyId() companyId: string,
    @CurrentUserId() userId: string,
    @Body() dto: RegisterPosSaleDto,
  ) {
    return this.posSale.registerSale(companyId, userId, dto);
  }
}
