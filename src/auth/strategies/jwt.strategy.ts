import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompanyUserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  currentCompanyId: string;
  role: CompanyUserRole;
  isSuperAdmin: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'mottatech-secret-change-in-production'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user?.active) throw new UnauthorizedException('Usuario inactivo');

    const companyId = payload.currentCompanyId;
    if (payload.isSuperAdmin) {
      return {
        id: user.id,
        email: user.email,
        companyId,
        role: payload.role,
        isSuperAdmin: true,
      };
    }

    const cu = await this.prisma.companyUser.findUnique({
      where: { userId_companyId: { userId: payload.sub, companyId } },
    });
    if (!cu) throw new UnauthorizedException('Sin acceso a esta empresa');
    return {
      id: user.id,
      email: user.email,
      companyId,
      role: cu.role,
      isSuperAdmin: false,
    };
  }
}
