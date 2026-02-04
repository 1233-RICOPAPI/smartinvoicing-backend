import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getPlanPrice, planIncludesApi, PlanCode, BillingInterval } from './constants/plans.constants';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateForCompany(companyId: string): Promise<{
    planCode: string;
    billingInterval: string;
    periodEnd: string;
    status: string;
    daysLeft: number;
    includesApi: boolean;
  }> {
    let sub = await (this.prisma as any).subscription.findUnique({
      where: { companyId },
    });
    if (!sub) {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      sub = await (this.prisma as any).subscription.create({
        data: {
          companyId,
          planCode: 'PROFESIONAL',
          billingInterval: 'MONTHLY',
          periodEnd,
          status: 'active',
        },
      });
    }
    const daysLeft = Math.max(0, Math.ceil((sub.periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    return {
      planCode: sub.planCode,
      billingInterval: sub.billingInterval,
      periodEnd: sub.periodEnd.toISOString(),
      status: sub.status,
      daysLeft,
      includesApi: planIncludesApi(sub.planCode as PlanCode),
    };
  }

  async canUseApi(companyId: string): Promise<boolean> {
    const sub = await (this.prisma as any).subscription.findUnique({
      where: { companyId },
    });
    if (!sub || sub.status !== 'active' || sub.periodEnd < new Date()) return false;
    return planIncludesApi(sub.planCode as PlanCode);
  }

  async hasActiveSubscription(companyId: string): Promise<boolean> {
    const sub = await (this.prisma as any).subscription.findUnique({
      where: { companyId },
    });
    return !!(sub && sub.status === 'active' && sub.periodEnd >= new Date());
  }

  async extendPeriod(companyId: string, planCode: PlanCode, interval: BillingInterval): Promise<void> {
    const sub = await (this.prisma as any).subscription.findUnique({ where: { companyId } });
    const now = new Date();
    const start = sub && sub.periodEnd > now ? sub.periodEnd : now;
    const end = new Date(start);
    if (interval === 'ANNUAL') {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    await (this.prisma as any).subscription.upsert({
      where: { companyId },
      create: { companyId, planCode, billingInterval: interval, periodEnd: end, status: 'active' },
      update: { planCode, billingInterval: interval, periodEnd: end, status: 'active' },
    });
  }

  getPriceForCheckout(planCode: PlanCode, annual: boolean): number {
    return getPlanPrice(planCode as 'EMPRENDER' | 'PROFESIONAL' | 'EMPRESARIAL', annual);
  }
}
