import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Asegura que el usuario tenga acceso a la empresa del contexto.
 * companyId puede venir de JWT (user.companyId) o de header X-Company-Id.
 * Si viene X-Company-Id, se valida y se sobrescribe el contexto para esa petición.
 */
@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return true;

    const headerCompanyId = request.headers['x-company-id'];
    const companyId = headerCompanyId?.trim() || user.companyId;
    if (!companyId) throw new ForbiddenException('Contexto de empresa requerido');

    if (user.isSuperAdmin) {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new ForbiddenException('Empresa no encontrada');
      request.user.companyId = companyId;
      return true;
    }

    const cu = await this.prisma.companyUser.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    });
    if (!cu) throw new ForbiddenException('No tiene acceso a esta empresa');
    request.user.companyId = companyId;
    request.user.role = cu.role;
    return true;
  }
}
