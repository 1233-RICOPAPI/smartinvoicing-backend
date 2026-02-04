import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnomalyEvent, AnomalyEventSchema } from './schemas/anomaly-event.schema';
import { RiskScore, RiskScoreSchema } from './schemas/risk-score.schema';
import { ModelMetrics, ModelMetricsSchema } from './schemas/model-metrics.schema';
import { FraudRulesEngine } from './services/fraud-rules-engine.service';
import { AnomalyDetectionService } from './services/anomaly-detection.service';
import { RiskScoringService } from './services/risk-scoring.service';
import { AccountingAnalyticsService } from './services/accounting-analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnomalyEvent.name, schema: AnomalyEventSchema },
      { name: RiskScore.name, schema: RiskScoreSchema },
      { name: ModelMetrics.name, schema: ModelMetricsSchema },
    ]),
  ],
  providers: [
    FraudRulesEngine,
    AnomalyDetectionService,
    RiskScoringService,
    AccountingAnalyticsService,
  ],
  controllers: [AnalyticsController],
  exports: [
    AnomalyDetectionService,
    RiskScoringService,
    AccountingAnalyticsService,
    FraudRulesEngine,
  ],
})
export class AnalyticsModule {}
