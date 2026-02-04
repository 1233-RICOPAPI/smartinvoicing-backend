import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RiskScore, RiskScoreDocument } from '../schemas/risk-score.schema';
import { AnomalyEvent, AnomalyEventDocument } from '../schemas/anomaly-event.schema';

/**
 * Calcula y persiste puntuaciones de riesgo (0-100) por entidad (usuario, documento, período).
 * No bloquea; solo almacena para dashboards y alertas.
 */
@Injectable()
export class RiskScoringService {
  constructor(
    @InjectModel(AnomalyEvent.name) private anomalyModel: Model<AnomalyEventDocument>,
    @InjectModel(RiskScore.name) private riskModel: Model<RiskScoreDocument>,
  ) {}

  /**
   * Calcula score de riesgo para un usuario en un período a partir de anomalías.
   */
  async calculateUserRiskScore(
    companyId: string,
    userId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{ score: number; contributingCount: number }> {
    const anomalies = await this.anomalyModel
      .find({
        companyId,
        userId,
        detectedAt: { $gte: periodStart, $lte: periodEnd },
      })
      .lean()
      .exec();

    const score = this.aggregateScore(anomalies);
    const ids = anomalies.map((a) => (a as any)._id?.toString()).filter(Boolean);

    await this.riskModel.updateOne(
      { companyId, entityType: 'USER', entityId: userId, periodStart, periodEnd },
      {
        $set: {
          companyId,
          entityType: 'USER',
          entityId: userId,
          score,
          calculatedAt: new Date(),
          periodStart,
          periodEnd,
          contributingAnomalies: ids,
          breakdown: { anomalyCount: anomalies.length, maxSeverity: this.maxSeverityValue(anomalies) },
        },
      },
      { upsert: true },
    );

    return { score, contributingCount: anomalies.length };
  }

  /**
   * Obtiene el último score de riesgo de una entidad.
   */
  async getLatestRiskScore(
    companyId: string,
    entityType: string,
    entityId: string,
  ): Promise<RiskScoreDocument | null> {
    return this.riskModel
      .findOne({ companyId, entityType, entityId })
      .sort({ calculatedAt: -1 })
      .lean()
      .exec() as Promise<RiskScoreDocument | null>;
  }

  private aggregateScore(anomalies: Array<{ severity?: string; score?: number }>): number {
    if (anomalies.length === 0) return 0;
    const weights = { CRITICAL: 1.2, HIGH: 1, MEDIUM: 0.7, LOW: 0.4 };
    let weighted = 0;
    let count = 0;
    for (const a of anomalies) {
      const w = weights[a.severity as keyof typeof weights] ?? 0.7;
      weighted += (a.score ?? 50) * w;
      count++;
    }
    const avg = count ? weighted / count : 0;
    return Math.min(100, Math.round(avg));
  }

  private maxSeverityValue(anomalies: Array<{ severity?: string }>): number {
    const map: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    let max = 0;
    for (const a of anomalies) {
      const v = map[a.severity ?? ''] ?? 0;
      if (v > max) max = v;
    }
    return max;
  }
}
