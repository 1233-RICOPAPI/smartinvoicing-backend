import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PlansController } from './plans.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PlansController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class PlansModule {}
