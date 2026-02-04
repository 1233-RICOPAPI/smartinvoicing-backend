import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, active: true, isSuperAdmin: true },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, active: true, isSuperAdmin: true },
    });
  }

  findCompanyUser(userId: string, companyId: string) {
    return this.prisma.companyUser.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { company: true },
    });
  }
}
