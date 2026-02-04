import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnomalyEventDocument = AnomalyEvent & Document;

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

@Schema({ collection: 'anomaly_events', timestamps: true })
export class AnomalyEvent {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  severity: AnomalySeverity;

  @Prop({ required: true, min: 0, max: 100 })
  score: number;

  @Prop()
  userId?: string;

  @Prop()
  documentId?: string;

  @Prop()
  documentType?: string;

  @Prop({ required: true, default: () => new Date() })
  detectedAt: Date;

  @Prop({ required: true })
  explanation: string;

  @Prop()
  recommendation?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const AnomalyEventSchema = SchemaFactory.createForClass(AnomalyEvent);
AnomalyEventSchema.index({ companyId: 1, detectedAt: -1 });
AnomalyEventSchema.index({ companyId: 1, type: 1 });
AnomalyEventSchema.index({ companyId: 1, userId: 1, detectedAt: -1 });
