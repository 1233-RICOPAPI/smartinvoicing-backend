import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Asegura que el recurso pertenezca a la empresa del usuario (multi-tenant).
 * Usar en rutas que reciban :companyId o body.companyId.
 */
@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userCompanyId = request.user?.companyId;
    const resourceCompanyId = request.params?.companyId ?? request.body?.companyId;
    if (!resourceCompanyId || !userCompanyId) return true; // Dejar que otros guards fallen
    if (resourceCompanyId !== userCompanyId) {
      throw new ForbiddenException('No tiene acceso a este recurso de otra empresa');
    }
    return true;
  }
}
