import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CopilotCacheDocument = CopilotCache & Document;

@Schema({ collection: 'copilot_cache', timestamps: true })
export class CopilotCache {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true })
  queryHash: string;

  @Prop({ required: true })
  intent: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ type: Object })
  data?: Record<string, unknown>;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const CopilotCacheSchema = SchemaFactory.createForClass(CopilotCache);
CopilotCacheSchema.index({ companyId: 1, queryHash: 1 }, { unique: true });
