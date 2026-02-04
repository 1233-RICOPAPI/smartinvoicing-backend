import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AccountingEngineService } from '../../accounting/services/accounting-engine.service';
import { DianDocumentType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { RegisterPosSaleDto } from '../dtos/register-pos-sale.dto';
import { AccountingDocumentType } from '../../accounting/enums/document-type.enum';
import { DianResolutionService } from '../../../dian/resolution/dian-resolution.service';

/**
 * Flujo POS: Venta → Validación stock → Descuento inventario → Documento POS → Asientos contables → Pagos.
 * Numeración según Resolución DIAN activa cuando exista.
 */
@Injectable()
export class PosSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingEngine: AccountingEngineService,
    private readonly dianResolution: DianResolutionService,
  ) {}

  async registerSale(companyId: string, userId: string, dto: RegisterPosSaleDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Debe incluir al menos un ítem.');
    }
    if (!dto.payments?.length) {
      throw new BadRequestException('Debe incluir al menos un medio de pago.');
    }

    const client = await this.prisma.client.findFirstOrThrow({
      where: { id: dto.clientId, companyId },
    });

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { companyId, isDefault: true },
    });
    if (!warehouse) {
      throw new BadRequestException('Configure un almacén por defecto para POS.');
    }

    const productsWithStock: Array<{
      productId: string;
      product: { id: string; name: string; code: string; price: Decimal; cost: Decimal | null; ivaRate: Decimal; unit: string; trackInventory: boolean };
      quantity: number;
      unitPrice: number;
      cost: number;
      lineSubtotal: number;
      lineTax: number;
      lineTotal: number;
    }> = [];
    let subtotal = 0;
    let totalTax = 0;

    for (const item of dto.items) {
      const product = await this.prisma.product.findFirstOrThrow({
        where: { id: item.productId, companyId },
      });
      const qty = item.quantity;
      const unitPrice = item.unitPrice ?? Number(product.price);
      const cost = product.cost != null ? Number(product.cost) : 0;
      if (product.trackInventory) {
        const stock = await this.prisma.productWarehouse.findFirst({
          where: { productId: product.id, warehouseId: warehouse.id },
        });
        const available = stock?.quantity ?? 0;
        if (available < qty) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name} (cód. ${product.code}). Disponible: ${available}, solicitado: ${qty}.`,
          );
        }
      }
      const lineSubtotal = qty * unitPrice;
      const ivaRate = Number(product.ivaRate ?? 19);
      const lineTax = (lineSubtotal * ivaRate) / 100;
      const lineTotal = lineSubtotal + lineTax;
      subtotal += lineSubtotal;
      totalTax += lineTax;
      productsWithStock.push({
        productId: product.id,
        product: product as any,
        quantity: qty,
        unitPrice,
        cost: cost * qty,
        lineSubtotal,
        lineTax,
        lineTotal,
      });
    }

    const total = subtotal + totalTax;
    const paymentSum = dto.payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paymentSum - total) > 0.02) {
      throw new BadRequestException(
        `La suma de pagos (${paymentSum.toFixed(2)}) no coincide con el total (${total.toFixed(2)}).`,
      );
    }

    let posSessionId = dto.posSessionId;
    if (!posSessionId) {
      const openSession = await this.prisma.posSession.findFirst({
        where: { companyId, status: 'OPEN' },
      });
      if (!openSession) {
        throw new BadRequestException('No hay sesión POS abierta. Abra una sesión antes de vender.');
      }
      posSessionId = openSession.id;
    }

    const { prefix, number: nextNumber, fullNumber } =
      await this.dianResolution.getNextAuthorizedNumber(companyId, DianDocumentType.FACTURA_POS);
    const issueDate = new Date();

    const costOfGoodsSold = productsWithStock.reduce((s, i) => s + i.cost, 0);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          companyId,
          clientId: client.id,
          type: DianDocumentType.FACTURA_POS,
          prefix,
          number: nextNumber,
          fullNumber,
          issueDate,
          currency: 'COP',
          subtotal: new Decimal(subtotal),
          discount: new Decimal(0),
          taxAmount: new Decimal(totalTax),
          total: new Decimal(total),
          status: 'CREADA',
          posSessionId,
          items: {
            create: productsWithStock.map((p, order) => ({
              productId: p.productId,
              description: p.product.name,
              quantity: new Decimal(p.quantity),
              unit: p.product.unit,
              unitPrice: new Decimal(p.unitPrice),
              discount: new Decimal(0),
              subtotal: new Decimal(p.lineSubtotal),
              taxAmount: new Decimal(p.lineTax),
              total: new Decimal(p.lineTotal),
              ivaRate: p.product.ivaRate,
              order,
            })),
          },
          taxes: {
            create: [
              { taxType: 'IVA', rate: new Decimal(19), base: new Decimal(subtotal), amount: new Decimal(totalTax) },
            ],
          },
        },
        include: { items: true },
      });

      for (const p of productsWithStock) {
        if (p.product.trackInventory) {
          await tx.inventoryMovement.create({
            data: {
              companyId,
              type: 'SALIDA',
              productId: p.productId,
              warehouseId: warehouse.id,
              quantity: p.quantity,
              reference: fullNumber,
              referenceId: inv.id,
              cost: p.cost / p.quantity,
            },
          });
          const pw = await tx.productWarehouse.findFirst({
            where: { productId: p.productId, warehouseId: warehouse.id },
          });
          if (pw) {
            await tx.productWarehouse.update({
              where: { id: pw.id },
              data: { quantity: pw.quantity - p.quantity },
            });
          }
        }
      }

      for (const pay of dto.payments) {
        await tx.invoicePayment.create({
          data: { invoiceId: inv.id, method: pay.method, amount: new Decimal(pay.amount) },
        });
      }

      const entryDto = {
        documentType: AccountingDocumentType.FACTURA_POS,
        documentNumber: fullNumber,
        date: issueDate.toISOString().slice(0, 10),
        subtotal,
        taxAmount: totalTax,
        total,
        documentId: inv.id,
        costOfGoodsSold: costOfGoodsSold > 0 ? costOfGoodsSold : undefined,
      };
      const journalEntry = await this.accountingEngine.generateJournalEntry(companyId, entryDto as any);
      await this.accountingEngine.persistJournalEntry(
        { ...journalEntry, documentId: inv.id },
        tx as any,
      );

      return tx.invoice.findUniqueOrThrow({
        where: { id: inv.id },
        include: { items: { include: { product: true } }, payments: true },
      });
    });

    return invoice;
  }
}
