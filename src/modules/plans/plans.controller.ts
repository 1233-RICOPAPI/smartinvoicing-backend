import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CurrentCompanyId } from '../../common/decorators/company.decorator';
import { SubscriptionService } from './subscription.service';
import { PLANS } from './constants/plans.constants';

@Controller('plans')
export class PlansController {
  constructor(private subscription: SubscriptionService) {}

  @Get()
  listPlans() {
    return {
      plans: Object.values(PLANS).map((p) => ({
        code: p.code,
        name: p.name,
        monthlyPrice: p.monthlyPrice,
        annualPrice: p.annualPrice,
        features: p.features,
        hasApiAccess: p.hasApiAccess,
      })),
    };
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  getMySubscription(@CurrentCompanyId() companyId: string) {
    return this.subscription.getOrCreateForCompany(companyId);
  }
}
