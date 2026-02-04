import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SubscriptionService } from '../../modules/plans/subscription.service';
import { CompanyAccessGuard } from './company-access.guard';

/**
 * Verifica que la empresa tenga un plan activo que incluya acceso API (Modo Developer).
 * Debe usarse después de JwtAuthGuard y CompanyAccessGuard para tener companyId en request.
 */
@Injectable()
export class PlanApiGuard implements CanActivate {
  constructor(private subscription: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const companyId = req.user?.companyId ?? req.headers?.['x-company-id'];
    if (!companyId) throw new ForbiddenException('Se requiere plan Profesional o Empresarial para usar la API de desarrollador.');
    const canUse = await this.subscription.canUseApi(companyId);
    if (!canUse) {
      throw new ForbiddenException('Tu plan no incluye acceso a la API. Actualiza a Profesional o Empresarial.');
    }
    return true;
  }
}
