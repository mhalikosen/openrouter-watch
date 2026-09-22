import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '#config/env.config.js';

const fileName = (key: string) =>
  `${key.replace(/[^a-zA-Z0-9._-]+/g, '__')}.json`;

@Injectable()
export class SnapshotService {
  private readonly dir: string;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.dir = config.get('SNAPSHOT_DIR', { infer: true });
  }

  async read<Value>(key: string): Promise<Value | undefined> {
    try {
      const text = await readFile(join(this.dir, fileName(key)), 'utf8');

      return JSON.parse(text) as Value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  async write<Value>(key: string, value: Value): Promise<void> {
    await mkdir(this.dir, { recursive: true });

    const path = join(this.dir, fileName(key));
    const temporary = `${path}.tmp`;

    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
  }
}
