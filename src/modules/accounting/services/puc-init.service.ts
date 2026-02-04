import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ACCOUNT_KEYS } from '../constants/account-keys';

/**
 * Cuentas PUC mínimas para Colombia (compatible con el motor contable).
 * code debe ser único por empresa; level 1 = agrupador, 2 = cuenta de movimiento.
 */
const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: string;
  level: number;
  accountKey: keyof typeof ACCOUNT_KEYS;
}> = [
  { code: '1105', name: 'Caja', type: 'Activo', level: 2, accountKey: 'CAJA' },
  { code: '1305', name: 'Clientes nacionales', type: 'Activo', level: 2, accountKey: 'CLIENTES_NACIONALES' },
  { code: '1405', name: 'Inventario de mercancías', type: 'Activo', level: 2, accountKey: 'INVENTARIO' },
  { code: '2205', name: 'Proveedores nacionales', type: 'Pasivo', level: 2, accountKey: 'PROVEEDORES' },
  { code: '240801', name: 'IVA generado', type: 'Pasivo', level: 2, accountKey: 'IVA_GENERADO' },
  { code: '240802', name: 'IVA descontable', type: 'Activo', level: 2, accountKey: 'IVA_DESCONTABLE' },
  { code: '240803', name: 'Retención en la fuente', type: 'Pasivo', level: 2, accountKey: 'RETENCION_FUENTE' },
  { code: '240804', name: 'Retención ICA', type: 'Pasivo', level: 2, accountKey: 'RETENCION_ICA' },
  { code: '240805', name: 'Retención IVA', type: 'Pasivo', level: 2, accountKey: 'RETENCION_IVA' },
  { code: '4135', name: 'Ingresos operacionales - ventas', type: 'Ingreso', level: 2, accountKey: 'INGRESOS_VENTAS' },
  { code: '5110', name: 'Costos de mercancías', type: 'Costo', level: 2, accountKey: 'COSTOS_MERCANCIAS' },
  { code: '5195', name: 'Gastos operacionales', type: 'Gasto', level: 2, accountKey: 'GASTOS' },
];

@Injectable()
export class PucInitService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea las cuentas PUC mínimas y los mapeos para la empresa.
   * Idempotente: si la cuenta ya existe, la reutiliza; solo crea mapeos faltantes.
   */
  async initPuc(companyId: string): Promise<{ created: number; mappings: number }> {
    let created = 0;
    let mappings = 0;

    for (const def of DEFAULT_ACCOUNTS) {
      let account = await this.prisma.accountingAccount.findUnique({
        where: { companyId_code: { companyId, code: def.code } },
      });
      if (!account) {
        account = await this.prisma.accountingAccount.create({
          data: {
            companyId,
            code: def.code,
            name: def.name,
            type: def.type,
            level: def.level,
            allowMovement: true,
          },
        });
        created++;
      }

      const existingMapping = await this.prisma.companyAccountMapping.findUnique({
        where: { companyId_accountKey: { companyId, accountKey: def.accountKey } },
      });
      if (!existingMapping) {
        await this.prisma.companyAccountMapping.create({
          data: {
            companyId,
            accountKey: def.accountKey,
            accountId: account.id,
          },
        });
        mappings++;
      }
    }

    return { created, mappings };
  }

  /** Indica si la empresa ya tiene el PUC inicial (al menos un mapeo). */
  async hasPuc(companyId: string): Promise<boolean> {
    const count = await this.prisma.companyAccountMapping.count({
      where: { companyId },
    });
    return count > 0;
  }
}
