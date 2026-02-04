import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AccountingSnapshot,
  AccountingSnapshotSchema,
} from './schemas/accounting-snapshot.schema';
import { SnapshotGenerationService } from './services/snapshot-generation.service';
import { CloseMonthService } from './services/close-month.service';
import { SnapshotsController } from './snapshots.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccountingSnapshot.name, schema: AccountingSnapshotSchema },
    ]),
  ],
  providers: [SnapshotGenerationService, CloseMonthService],
  controllers: [SnapshotsController],
  exports: [SnapshotGenerationService, CloseMonthService],
})
export class SnapshotsModule {}
