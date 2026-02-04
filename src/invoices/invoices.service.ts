import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DianDocumentType } from '@prisma/client';
import { CreateInvoiceDto, CreateInvoiceItemDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreateInvoiceDto) {
    const client = await this.prisma.client.findFirstOrThrow({
      where: { id: dto.clientId, companyId },
    });

    const config = await this.prisma.dianConfig.findUnique({
      where: { companyId },
    });
    const prefix = dto.type === 'FACTURA_POS' ? (config?.prefixPos ?? 'FCP') : (config?.prefixFe ?? 'SETP');
    const fromNumber = config?.fromNumber ?? 1;

    const last = await this.prisma.invoice.findFirst({
      where: { companyId, type: dto.type },
      orderBy: { number: 'desc' },
    });
    const nextNumber = last ? last.number + 1 : fromNumber;
    const fullNumber = `${prefix}${String(nextNumber).padStart(8, '0')}`;

    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    let subtotal = 0;
    let totalTax = 0;
    const itemsData = await Promise.all(
      dto.items.map(async (item: CreateInvoiceItemDto, order: number) => {
        const product = await this.prisma.product.findFirstOrThrow({
          where: { id: item.productId, companyId },
        });
        const qty = Number(item.quantity);
        const unitPrice = Number(item.unitPrice ?? product.price);
        const discount = Number(item.discount ?? 0);
        const lineSubtotal = qty * unitPrice - discount;
        const ivaRate = Number(item.ivaRate ?? product.ivaRate);
        const lineTax = (lineSubtotal * ivaRate) / 100;
        const lineTotal = lineSubtotal + lineTax;
        subtotal += lineSubtotal;
        totalTax += lineTax;
        return {
          productId: product.id,
          description: item.description ?? product.name,
          quantity: new Decimal(qty),
          unit: item.unit ?? product.unit,
          unitPrice: new Decimal(unitPrice),
          discount: new Decimal(discount),
          subtotal: new Decimal(lineSubtotal),
          taxAmount: new Decimal(lineTax),
          total: new Decimal(lineTotal),
          ivaRate: new Decimal(ivaRate),
          order,
        };
      }),
    );

    const discountTotal = Number(dto.discount ?? 0);
    const subtotalAfterDiscount = subtotal - discountTotal;
    const taxAfterDiscount = (subtotalAfterDiscount / subtotal) * totalTax || totalTax;
    const total = subtotalAfterDiscount + taxAfterDiscount;

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId,
        clientId: client.id,
        type: dto.type as DianDocumentType,
        prefix,
        number: nextNumber,
        fullNumber,
        issueDate,
        dueDate,
        currency: dto.currency ?? 'COP',
        subtotal: new Decimal(subtotalAfterDiscount),
        discount: new Decimal(discountTotal),
        taxAmount: new Decimal(taxAfterDiscount),
        total: new Decimal(total),
        status: 'CREADA',
        notes: dto.notes,
        posSessionId: dto.posSessionId,
        items: {
          create: itemsData,
        },
        taxes: {
          create: [
            {
              taxType: 'IVA',
              rate: new Decimal(
                itemsData.reduce((a, i) => (a + Number(i.ivaRate)) / (itemsData.length || 1), 0),
              ),
              base: new Decimal(subtotalAfterDiscount),
              amount: new Decimal(taxAfterDiscount),
            },
          ],
        },
      },
      include: {
        client: true,
        items: { include: { product: true } },
      },
    });

    return invoice;
  }

  async findAll(companyId: string, filters?: { status?: string; type?: string }) {
    const where: any = { companyId };
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    return this.prisma.invoice.findMany({
      where,
      include: { client: true },
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
    });
  }

  async findOne(companyId: string, id: string) {
    return this.prisma.invoice.findFirstOrThrow({
      where: { id, companyId },
      include: {
        client: true,
        items: { include: { product: true } },
        taxes: true,
        dianDoc: true,
      },
    });
  }

  async getXml(companyId: string, invoiceId: string): Promise<string> {
    const doc = await this.prisma.dianDocument.findFirst({
      where: { invoiceId, companyId },
    });
    if (!doc?.xmlSent) throw new BadRequestException('Factura sin XML firmado');
    return doc.xmlSent;
  }
}
