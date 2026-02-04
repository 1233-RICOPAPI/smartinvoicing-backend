import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DianHistoryDocument = DianHistory & Document;

@Schema({ collection: 'dian_history', timestamps: true })
export class DianHistory {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true })
  invoiceId: string;

  @Prop()
  dianDocumentId?: string;

  @Prop()
  xmlSent?: string;

  @Prop()
  responsePayload?: string;

  @Prop()
  statusDian?: string;

  @Prop()
  isValid?: boolean;

  @Prop({ default: () => new Date() })
  sentAt: Date;

  @Prop()
  attemptNumber?: number;
}

export const DianHistorySchema = SchemaFactory.createForClass(DianHistory);
DianHistorySchema.index({ companyId: 1, invoiceId: 1, sentAt: -1 });
DianHistorySchema.index({ companyId: 1, statusDian: 1 });
