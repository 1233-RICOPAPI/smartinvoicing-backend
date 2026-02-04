import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { CopilotConversation, CopilotConversationDocument } from '../schemas/copilot-conversation.schema';
import { CopilotCache, CopilotCacheDocument } from '../schemas/copilot-cache.schema';
import { IntentParserService } from './intent-parser.service';
import { QueryEngineService } from './query-engine.service';
import { ReasoningService } from './reasoning.service';
import { COPILOT_INTENTS } from '../constants/intents';
import type { CopilotResponseDto } from '../dtos/copilot-query.dto';

const FALLBACK_ANSWER = 'No encontré contenido relacionado con tu pregunta en la base de datos. Puedes preguntar por: balance general, estado de resultados, facturación, IVA, retenciones, comparación o anomalías.';

@Injectable()
export class CopilotService {
  constructor(
    private readonly intentParser: IntentParserService,
    private readonly queryEngine: QueryEngineService,
    private readonly reasoning: ReasoningService,
    @InjectModel(CopilotConversation.name)
    private readonly conversationModel: Model<CopilotConversationDocument>,
    @InjectModel(CopilotCache.name)
    private readonly cacheModel: Model<CopilotCacheDocument>,
  ) {}

  async query(companyId: string, userId: string, query: string, conversationId?: string): Promise<CopilotResponseDto> {
    const normalizedQuery = (query ?? '').toString().trim();
    if (!normalizedQuery) {
      return this.buildResponse(conversationId ?? uuidv4(), FALLBACK_ANSWER, {}, COPILOT_INTENTS.UNKNOWN, undefined, undefined);
    }

    const parsed = this.intentParser.parse(normalizedQuery);
    const cacheKey = this.hashQuery(companyId, normalizedQuery, parsed.from, parsed.to);
    const cached = await this.cacheModel.findOne({ companyId, queryHash: cacheKey }).lean().exec();
    if (cached) {
      const cid = conversationId ?? uuidv4();
      await this.appendToConversation(companyId, userId, cid, normalizedQuery, cached.answer, cached.data);
      return {
        answer: cached.answer,
        data: cached.data as Record<string, unknown>,
        conversationId: cid,
        intent: cached.intent,
        from: cached.from,
        to: cached.to,
      };
    }

    let data: Record<string, unknown>;
    let answer: string;
    try {
      data = await this.queryEngine.execute(companyId, parsed);
      answer = this.reasoning.formatAnswer(parsed.intent, data);
      if (!answer?.trim()) answer = FALLBACK_ANSWER;
      if (parsed.intent === COPILOT_INTENTS.UNKNOWN || parsed.intent === COPILOT_INTENTS.EXPLAIN) {
        const geminiAnswer = await this.geminiFallback.ask(normalizedQuery);
        if (geminiAnswer?.trim()) answer = geminiAnswer.trim();
      }
    } catch {
      const geminiAnswer = await this.geminiFallback.ask(normalizedQuery);
      if (geminiAnswer?.trim()) {
        answer = geminiAnswer.trim();
        data = { from: parsed.from, to: parsed.to };
      } else {
        answer = FALLBACK_ANSWER;
        data = { from: parsed.from, to: parsed.to, message: FALLBACK_ANSWER };
      }
    }

    await this.cacheModel.updateOne(
      { companyId, queryHash: cacheKey },
      {
        $set: {
          companyId,
          queryHash: cacheKey,
          intent: parsed.intent,
          answer,
          data,
          from: parsed.from,
          to: parsed.to,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    ).exec();

    const cid = conversationId ?? uuidv4();
    await this.appendToConversation(companyId, userId, cid, normalizedQuery, answer, data);

    return {
      answer,
      data,
      conversationId: cid,
      intent: parsed.intent,
      from: parsed.from,
      to: parsed.to,
    };
  }

  private buildResponse(
    conversationId: string,
    answer: string,
    data: Record<string, unknown>,
    intent: string,
    from?: string,
    to?: string,
  ): CopilotResponseDto {
    return { answer, data, conversationId, intent, from, to };
  }

  private hashQuery(companyId: string, query: string, from: string, to: string): string {
    const normalized = `${companyId}:${query.trim().toLowerCase()}:${from}:${to}`;
    return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  }

  private async appendToConversation(
    companyId: string,
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.conversationModel.findOneAndUpdate(
      { companyId, userId, conversationId },
      {
        $setOnInsert: { companyId, userId, conversationId },
        $set: { lastActivityAt: new Date() },
        $push: {
          messages: {
            $each: [
              { role: 'user', content: userMessage, at: new Date() },
              { role: 'assistant', content: assistantMessage, data, at: new Date() },
            ],
          },
        },
      },
      { upsert: true, new: true },
    ).exec();
  }
}
