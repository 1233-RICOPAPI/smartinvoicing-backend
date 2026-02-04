import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  create(companyId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        companyId,
        name: dto.name,
        nit: dto.nit,
        dv: dto.dv,
        address: dto.address,
        city: dto.city,
        country: dto.country ?? 'CO',
        email: dto.email,
        phone: dto.phone,
        personType: dto.personType ?? 'Jurídica',
        rutResponsible: dto.rutResponsible ?? false,
        rutCodes: dto.rutCodes ? JSON.stringify(dto.rutCodes) : null,
      },
    });
  }

  findAll(companyId: string) {
    return this.prisma.client.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  findOne(companyId: string, id: string) {
    return this.prisma.client.findFirstOrThrow({
      where: { id, companyId },
    });
  }

  update(companyId: string, id: string, dto: UpdateClientDto) {
    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.nit && { nit: dto.nit }),
        ...(dto.dv !== undefined && { dv: dto.dv }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.personType && { personType: dto.personType }),
        ...(dto.rutResponsible !== undefined && { rutResponsible: dto.rutResponsible }),
        ...(dto.rutCodes && { rutCodes: JSON.stringify(dto.rutCodes) }),
      },
    });
  }
}
