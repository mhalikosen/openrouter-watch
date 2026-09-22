import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '#app/app.module.js';
import { Environment } from '#config/env.config.js';
import { WatchService } from '#watch/watch.service.js';

async function bootstrap() {
  const production = process.env.NODE_ENV === Environment.Production;
  const once = process.argv.includes('--once');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new ConsoleLogger({
      json: production,
      colors: !production,
      compact: production,
    }),
  });
  const watch = app.get(WatchService);

  if (once) {
    const run = await watch.run();

    await app.close();
    process.exitCode = run.failed.length > 0 ? 1 : 0;
    return;
  }

  app.enableShutdownHooks();
  watch.schedule();
}
await bootstrap();
