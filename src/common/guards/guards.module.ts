import { Global, Module } from '@nestjs/common';
import { CompanyAccessGuard } from './company-access.guard';

/**
 * Módulo que provee guards de acceso por empresa.
 * Importado por módulos que usan CompanyAccessGuard en sus controllers.
 */
@Global()
@Module({
  providers: [CompanyAccessGuard],
  exports: [CompanyAccessGuard],
})
export class GuardsModule {}
