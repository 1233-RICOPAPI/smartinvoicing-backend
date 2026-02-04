import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { CompanyUserRole } from '@prisma/client';
import { LoginDto, RegisterCompanyDto, RegisterUserDto } from './dto';

export interface CompanyInfo {
  companyId: string;
  companyName: string;
  role: CompanyUserRole;
}

export interface LoginResult {
  access_token: string;
  user: { id: string; email: string; name: string; currentCompanyId: string; role: CompanyUserRole; isSuperAdmin: boolean };
  companies: CompanyInfo[];
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async registerCompany(dto: RegisterCompanyDto): Promise<LoginResult> {
    const existingCompany = await this.prisma.company.findUnique({ where: { nit: dto.companyNit } });
    if (existingCompany) throw new ConflictException('Ya existe una empresa con ese NIT');

    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const hashed = await bcrypt.hash(dto.password, 10);

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashed,
          name: dto.ownerName,
        },
      });
    } else {
      const ok = await bcrypt.compare(dto.password, user.password);
      if (!ok) throw new ConflictException('El email ya está registrado con otra contraseña');
    }

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        nit: dto.companyNit,
        dv: dto.companyDv ?? undefined,
        address: dto.companyAddress,
        city: dto.companyCity,
        country: dto.country ?? 'CO',
        email: dto.companyEmail,
      },
    });

    await this.prisma.companyUser.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      create: { userId: user.id, companyId: company.id, role: CompanyUserRole.OWNER },
      update: { role: CompanyUserRole.OWNER },
    });

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    try {
      await (this.prisma as any).subscription.create({
        data: {
          companyId: company.id,
          planCode: 'PROFESIONAL',
          billingInterval: 'MONTHLY',
          periodEnd,
          status: 'active',
        },
      });
    } catch {
      // Si la tabla Subscription no existe aún (migración pendiente), continuar sin suscripción
    }

    return this.buildLoginResult(user, company.id);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { companyUsers: { include: { company: true } } },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');
    if (!user.active) throw new UnauthorizedException('Usuario inactivo');

    if (user.isSuperAdmin && user.companyUsers.length === 0) {
      const firstCompany = await this.prisma.company.findFirst();
      if (firstCompany) {
        await this.prisma.companyUser.upsert({
          where: { userId_companyId: { userId: user.id, companyId: firstCompany.id } },
          create: { userId: user.id, companyId: firstCompany.id, role: CompanyUserRole.OWNER },
          update: {},
        });
      }
    }

    const companyUsers = await this.prisma.companyUser.findMany({
      where: { userId: user.id },
      include: { company: true },
    });
    if (!companyUsers.length && !user.isSuperAdmin) throw new UnauthorizedException('Usuario sin empresas asignadas');

    const currentCompanyId = companyUsers[0]?.companyId ?? (await this.prisma.company.findFirst())?.id;
    if (!currentCompanyId) throw new UnauthorizedException('No hay empresas en el sistema');
    return this.buildLoginResult(user, currentCompanyId);
  }

  async switchCompany(userId: string, companyId: string): Promise<{ access_token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { companyUsers: { where: { companyId }, include: { company: true } } },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (user.isSuperAdmin) {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new ForbiddenException('Empresa no encontrada');
      const token = this.signToken(user.id, user.email, companyId, CompanyUserRole.OWNER, user.isSuperAdmin);
      return { access_token: token };
    }
    const cu = user.companyUsers[0];
    if (!cu) throw new ForbiddenException('No tiene acceso a esta empresa');
    const token = this.signToken(user.id, user.email, companyId, cu.role, false);
    return { access_token: token };
  }

  async getCompanies(userId: string): Promise<CompanyInfo[]> {
    const list = await this.prisma.companyUser.findMany({
      where: { userId },
      include: { company: true },
    });
    return list.map((cu) => ({
      companyId: cu.companyId,
      companyName: cu.company.name,
      role: cu.role,
    }));
  }

  async registerUser(companyId: string, dto: RegisterUserDto, invitedById: string): Promise<{ id: string; email: string; role: CompanyUserRole }> {
    const role = (dto.role as CompanyUserRole) ?? CompanyUserRole.EMPLEADO;
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const hashed = await bcrypt.hash(dto.password, 10);
    if (!user) {
      user = await this.prisma.user.create({
        data: { email: dto.email, password: hashed, name: dto.name },
      });
    } else {
      const exists = await this.prisma.companyUser.findUnique({
        where: { userId_companyId: { userId: user.id, companyId } },
      });
      if (exists) throw new ConflictException('El usuario ya está en esta empresa');
    }
    await this.prisma.companyUser.create({
      data: { userId: user.id, companyId, role, invitedById },
    });
    return { id: user.id, email: user.email, role };
  }

  private async buildLoginResult(user: { id: string; email: string; name: string; isSuperAdmin: boolean }, currentCompanyId: string): Promise<LoginResult> {
    const companyUsers = await this.prisma.companyUser.findMany({
      where: { userId: user.id },
      include: { company: true },
    });
    const current = companyUsers.find((c) => c.companyId === currentCompanyId) ?? companyUsers[0];
    const role = current?.role ?? CompanyUserRole.OWNER;
    const token = this.signToken(user.id, user.email, currentCompanyId, role, user.isSuperAdmin);
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        currentCompanyId,
        role,
        isSuperAdmin: user.isSuperAdmin,
      },
      companies: companyUsers.map((cu) => ({ companyId: cu.companyId, companyName: cu.company.name, role: cu.role })),
    };
  }

  private signToken(sub: string, email: string, currentCompanyId: string, role: CompanyUserRole, isSuperAdmin: boolean): string {
    return this.jwt.sign({ sub, email, currentCompanyId, role, isSuperAdmin });
  }
}
