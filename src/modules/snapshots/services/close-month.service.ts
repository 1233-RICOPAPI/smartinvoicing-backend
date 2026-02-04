import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AccountingSnapshot,
  AccountingSnapshotDocument,
} from '../schemas/accounting-snapshot.schema';

/**
 * Cierre mensual contable. Fija status = CLOSED y bloquea reprocesamiento.
 * No recalcula ni modifica datos históricos cerrados.
 */
@Injectable()
export class CloseMonthService {
  constructor(
    @InjectModel(AccountingSnapshot.name)
    private readonly snapshotModel: Model<AccountingSnapshotDocument>,
  ) {}

  /**
   * Cierra el mes. El snapshot debe existir y estar OPEN.
   * Tras cerrar, no se puede regenerar ni modificar ese mes.
   */
  async closeMonth(
    companyId: string,
    year: number,
    month: number,
  ): Promise<AccountingSnapshotDocument> {
    const snapshot = await this.snapshotModel.findOne({ companyId, year, month });
    if (!snapshot) {
      throw new BadRequestException(
        `No existe snapshot para ${year}-${String(month).padStart(2, '0')}. Genere el snapshot antes de cerrar.`,
      );
    }
    if (snapshot.status === 'CLOSED') {
      throw new BadRequestException(
        `El mes ${year}-${String(month).padStart(2, '0')} ya está cerrado.`,
      );
    }

    snapshot.status = 'CLOSED';
    (snapshot as any).closedAt = new Date();
    await snapshot.save();
    return snapshot;
  }

  async getStatus(
    companyId: string,
    year: number,
    month: number,
  ): Promise<{ status: 'OPEN' | 'CLOSED' | null; closedAt?: Date } | null> {
    const doc = await this.snapshotModel
      .findOne({ companyId, year, month })
      .select('status closedAt')
      .lean();
    if (!doc) return null;
    return { status: doc.status, closedAt: doc.closedAt };
  }
}
