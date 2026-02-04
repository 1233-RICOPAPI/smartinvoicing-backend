import { Module } from '@nestjs/common';
import { DeveloperController } from './developer.controller';
import { DeveloperApiKeysService } from './developer-api-keys.service';
import { PlanApiGuard } from '../../common/guards/plan-api.guard';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { InvoicesModule } from '../../invoices/invoices.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PrismaModule, InvoicesModule, PlansModule],
  controllers: [DeveloperController],
  providers: [DeveloperApiKeysService, PlanApiGuard],
  exports: [DeveloperApiKeysService],
})
export class DeveloperModule {}
