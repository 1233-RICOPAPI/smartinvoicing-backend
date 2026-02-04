import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RiskScoreDocument = RiskScore & Document;

@Schema({ collection: 'risk_scores', timestamps: true })
export class RiskScore {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true })
  entityId: string;

  @Prop({ required: true, min: 0, max: 100 })
  score: number;

  @Prop({ required: true, default: () => new Date() })
  calculatedAt: Date;

  @Prop()
  periodStart?: Date;

  @Prop()
  periodEnd?: Date;

  @Prop({ type: [String] })
  contributingAnomalies?: string[];

  @Prop({ type: Object })
  breakdown?: Record<string, number>;
}

export const RiskScoreSchema = SchemaFactory.createForClass(RiskScore);
RiskScoreSchema.index({ companyId: 1, entityType: 1, entityId: 1 });
RiskScoreSchema.index({ companyId: 1, calculatedAt: -1 });
