import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CopilotConversation, CopilotConversationSchema } from './schemas/copilot-conversation.schema';
import { CopilotCache, CopilotCacheSchema } from './schemas/copilot-cache.schema';
import { IntentParserService } from './services/intent-parser.service';
import { QueryEngineService } from './services/query-engine.service';
import { ReasoningService } from './services/reasoning.service';
import { GeminiFallbackService } from './services/gemini-fallback.service';
import { CopilotService } from './services/copilot.service';
import { AiController } from './ai.controller';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: CopilotConversation.name, schema: CopilotConversationSchema },
      { name: CopilotCache.name, schema: CopilotCacheSchema },
    ]),
    ReportsModule,
    AnalyticsModule,
  ],
  providers: [IntentParserService, QueryEngineService, ReasoningService, GeminiFallbackService, CopilotService],
  controllers: [AiController],
  exports: [CopilotService],
})
export class AiModule {}
