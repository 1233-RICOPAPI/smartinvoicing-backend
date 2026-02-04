import { Module } from '@nestjs/common';
import { PosSaleService } from './services/pos-sale.service';
import { PosController } from './pos.controller';
import { AccountingModule } from '../accounting/accounting.module';
import { DianModule } from '../../dian/dian.module';

@Module({
  imports: [AccountingModule, DianModule],
  providers: [PosSaleService],
  controllers: [PosController],
  exports: [PosSaleService],
})
export class PosModule {}
