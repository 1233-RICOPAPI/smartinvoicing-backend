import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CufeService } from './services/cufe.service';
import { GenerateCufeDto } from './dto/generate-cufe.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('invoicing')
export class InvoicingController {
  constructor(private readonly cufeService: CufeService) {}

  /**
   * Genera CUFE con los 10 insumos obligatorios DIAN.
   * POST /invoicing/cufe
   */
  @Post('cufe')
  generateCUFE(@Body() dto: GenerateCufeDto) {
    const cufe = this.cufeService.generateCUFE(dto);
    return { cufe };
  }

  /**
   * Ejemplo con datos simulados válidos (sin auth para pruebas).
   * GET /invoicing/cufe/example
   */
  @Get('cufe/example')
  example() {
    return this.cufeService.exampleGenerateCUFE();
  }

  /**
   * Misma generación protegida por JWT (uso en flujo factura).
   */
  @Post('cufe/secure')
  @UseGuards(JwtAuthGuard)
  generateCufeSecure(@Body() dto: GenerateCufeDto) {
    const cufe = this.cufeService.generateCUFE(dto);
    return { cufe };
  }
}
