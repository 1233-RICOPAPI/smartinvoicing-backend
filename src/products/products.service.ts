import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  create(companyId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        companyId,
        code: dto.code,
        unspsc: dto.unspsc,
        name: dto.name,
        description: dto.description,
        type: dto.type ?? 'Producto',
        unit: dto.unit ?? '94',
        price: dto.price,
        cost: dto.cost,
        ivaRate: dto.ivaRate ?? 19,
        impoconsumo: dto.impoconsumo,
        trackInventory: dto.trackInventory ?? true,
        minStock: dto.minStock ?? 0,
      },
    });
  }

  findAll(companyId: string) {
    return this.prisma.product.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
  }

  findOne(companyId: string, id: string) {
    return this.prisma.product.findFirstOrThrow({
      where: { id, companyId },
    });
  }

  update(companyId: string, id: string, dto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code }),
        ...(dto.unspsc !== undefined && { unspsc: dto.unspsc }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type && { type: dto.type }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.cost !== undefined && { cost: dto.cost }),
        ...(dto.ivaRate !== undefined && { ivaRate: dto.ivaRate }),
        ...(dto.impoconsumo !== undefined && { impoconsumo: dto.impoconsumo }),
        ...(dto.trackInventory !== undefined && { trackInventory: dto.trackInventory }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
      },
    });
  }
}
