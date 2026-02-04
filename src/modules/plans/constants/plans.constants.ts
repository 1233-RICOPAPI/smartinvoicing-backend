/**
 * Planes: Emprender 30k, Profesional 70k, Empresarial 300k (mensual).
 * Anual = mismo valor × 12 con 20% descuento (pago por 12 meses).
 * Todos incluyen facturación ELC ilimitada durante el período pagado.
 */
export const PLANS = {
  EMPRENDER: {
    code: 'EMPRENDER',
    name: 'Emprender',
    monthlyPrice: 30_000,
    annualPrice: 30_000 * 12 * 0.8, // 288_000
    features: ['Facturación ELC ilimitada'],
    hasApiAccess: false,
  },
  PROFESIONAL: {
    code: 'PROFESIONAL',
    name: 'Profesional',
    monthlyPrice: 70_000,
    annualPrice: 70_000 * 12 * 0.8, // 672_000
    features: ['Facturación ELC ilimitada', 'API para sitios y apps (Modo Developer)'],
    hasApiAccess: true,
  },
  EMPRESARIAL: {
    code: 'EMPRESARIAL',
    name: 'Empresarial',
    monthlyPrice: 300_000,
    annualPrice: 300_000 * 12 * 0.8, // 2_880_000
    features: ['Facturación ELC ilimitada', 'API para sitios y apps', 'Soporte prioritario'],
    hasApiAccess: true,
  },
} as const;

export type PlanCode = keyof typeof PLANS;
export type BillingInterval = 'MONTHLY' | 'ANNUAL';

export function getPlanPrice(planCode: PlanCode, annual: boolean): number {
  const plan = PLANS[planCode];
  return annual ? plan.annualPrice : plan.monthlyPrice;
}

export function planIncludesApi(planCode: PlanCode): boolean {
  return PLANS[planCode as PlanCode]?.hasApiAccess ?? false;
}
