import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { EnvironmentVariables } from '#config/env.config.js';
import { MailService } from '#mail/mail.service.js';
import { OpenrouterService } from '#openrouter/openrouter.service.js';
import { SnapshotService } from '#snapshot/snapshot.service.js';
import { compareWatchedModels, toWatchedModel } from './watch.diff.util.js';
import { renderSubject, renderText } from './watch.report.template.js';
import { WatchedModel, WatchModelReport } from './watch.snapshot.type.js';

const JOB_NAME = 'watch';

export type WatchRun = {
  models: number;
  baselines: number;
  changes: number;
  failed: string[];
  mailed: boolean;
};

@Injectable()
export class WatchService {
  private readonly logger = new Logger(WatchService.name);
  private readonly models: string[];
  private readonly cron: string;
  private readonly timezone: string;
  private readonly thresholdPercent: number;
  private running = false;

  constructor(
    @Inject(OpenrouterService) private readonly openrouter: OpenrouterService,
    @Inject(SnapshotService) private readonly snapshot: SnapshotService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(SchedulerRegistry) private readonly registry: SchedulerRegistry,
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.models = config.get('WATCH_MODELS', { infer: true });
    this.cron = config.get('WATCH_CRON', { infer: true });
    this.timezone = config.get('WATCH_TIMEZONE', { infer: true });
    this.thresholdPercent = config.get('WATCH_SPEED_THRESHOLD_PERCENT', {
      infer: true,
    });
  }

  schedule(): void {
    const job = new CronJob(
      this.cron,
      () => {
        void this.guarded();
      },
      null,
      false,
      this.timezone,
    );

    this.registry.addCronJob(JOB_NAME, job);
    job.start();

    this.logger.log('watch.scheduled', {
      pattern: this.cron,
      timezone: this.timezone,
      models: this.models,
      nextRun: job.nextDate().toISO(),
    });
  }

  async run(): Promise<WatchRun> {
    if (!this.openrouter.hasKey) {
      this.logger.warn('watch.no-key', {
        effect: 'throughput and latency are not reported without a key',
      });
    }

    const takenAt = new Date().toISOString();
    const reports: WatchModelReport[] = [];
    const baselines: WatchedModel[] = [];
    const failed: string[] = [];

    for (const model of this.models) {
      try {
        const current = toWatchedModel(
          await this.openrouter.endpoints(model),
          model,
          takenAt,
        );
        const previous = await this.snapshot.read<WatchedModel>(model);

        if (previous === undefined) {
          baselines.push(current);
          continue;
        }

        reports.push({
          model,
          before: previous,
          after: current,
          changes: compareWatchedModels(
            previous,
            current,
            this.thresholdPercent,
          ),
        });
      } catch (error) {
        failed.push(model);
        this.logger.error('watch.model.failed', { model, error });
      }
    }

    const changed = reports.filter((report) => report.changes.length > 0);
    const changes = changed.reduce((n, report) => n + report.changes.length, 0);
    let mailed = false;

    if (changed.length > 0) {
      await this.mail.send({
        subject: renderSubject(changed),
        text: renderText(changed),
      });
      mailed = true;
    }

    for (const baseline of baselines) {
      await this.snapshot.write(baseline.model, baseline);
    }

    for (const report of reports) {
      await this.snapshot.write(report.model, report.after);
    }

    const summary: WatchRun = {
      models: this.models.length,
      baselines: baselines.length,
      changes,
      failed,
      mailed,
    };

    this.logger.log('watch.run', summary);

    return summary;
  }

  private async guarded(): Promise<void> {
    if (this.running) {
      this.logger.warn('watch.skipped', { reason: 'previous run still going' });
      return;
    }

    this.running = true;

    try {
      await this.run();
    } catch (error) {
      this.logger.error('watch.run.failed', { error });
    } finally {
      this.running = false;
    }
  }
}
