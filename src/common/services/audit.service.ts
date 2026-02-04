import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private auditModel: Model<AuditLogDocument>,
  ) {}

  async log(params: {
    companyId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    payload?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.auditModel.create({
      companyId: params.companyId,
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      payload: params.payload,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  /**
   * Lista registros de auditoría por empresa, entidad y opcionalmente entityId.
   */
  async findByEntity(
    companyId: string,
    entity: string,
    entityId: string,
  ): Promise<Array<{ action: string; payload?: Record<string, unknown>; createdAt: Date }>> {
    const list = await this.auditModel
      .find({ companyId, entity, entityId })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return list.map((d: any) => ({
      action: d.action,
      payload: d.payload,
      createdAt: d.createdAt,
    }));
  }
}
