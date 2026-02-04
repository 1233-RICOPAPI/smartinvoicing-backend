import { Module } from '@nestjs/common';
import { CufeService } from './services/cufe.service';
import { InvoicingController } from './invoicing.controller';

@Module({
  providers: [CufeService],
  controllers: [InvoicingController],
  exports: [CufeService],
})
export class InvoicingModule {}
