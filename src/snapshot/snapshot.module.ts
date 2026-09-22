import { Module } from '@nestjs/common';
import { SnapshotService } from './snapshot.service.js';

@Module({
  providers: [SnapshotService],
  exports: [SnapshotService],
})
export class SnapshotModule {}
