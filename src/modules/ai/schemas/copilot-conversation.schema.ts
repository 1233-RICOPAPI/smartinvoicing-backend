import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CopilotConversationDocument = CopilotConversation & Document;

@Schema({ _id: false })
export class CopilotMessage {
  @Prop({ required: true })
  role: 'user' | 'assistant';

  @Prop({ required: true })
  content: string;

  @Prop({ type: Object })
  data?: Record<string, unknown>;

  @Prop({ default: () => new Date() })
  at: Date;
}

export const CopilotMessageSchema = SchemaFactory.createForClass(CopilotMessage);

@Schema({ collection: 'copilot_conversations', timestamps: true })
export class CopilotConversation {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  conversationId: string;

  @Prop({ type: [CopilotMessageSchema], default: [] })
  messages: CopilotMessage[];

  @Prop({ default: () => new Date() })
  lastActivityAt: Date;
}

export const CopilotConversationSchema = SchemaFactory.createForClass(CopilotConversation);
CopilotConversationSchema.index({ companyId: 1, userId: 1, lastActivityAt: -1 });
