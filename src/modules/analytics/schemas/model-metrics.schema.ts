import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ModelMetricsDocument = ModelMetrics & Document;

@Schema({ collection: 'model_metrics', timestamps: true })
export class ModelMetrics {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true })
  modelName: string;

  @Prop({ required: true })
  period: string;

  @Prop({ required: true, default: () => new Date() })
  calculatedAt: Date;

  @Prop()
  precision?: number;

  @Prop()
  recall?: number;

  @Prop()
  f1Score?: number;

  @Prop()
  anomalyCount?: number;

  @Prop()
  truePositiveCount?: number;

  @Prop()
  falsePositiveCount?: number;

  @Prop({ type: Object })
  params?: Record<string, unknown>;
}

export const ModelMetricsSchema = SchemaFactory.createForClass(ModelMetrics);
ModelMetricsSchema.index({ companyId: 1, modelName: 1, period: 1 }, { unique: true });
