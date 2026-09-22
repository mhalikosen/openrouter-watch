import { Module } from '@nestjs/common';
import { MailModule } from '#mail/mail.module.js';
import { OpenrouterModule } from '#openrouter/openrouter.module.js';
import { SnapshotModule } from '#snapshot/snapshot.module.js';
import { WatchService } from './watch.service.js';

@Module({
  imports: [OpenrouterModule, SnapshotModule, MailModule],
  providers: [WatchService],
  exports: [WatchService],
})
export class WatchModule {}
