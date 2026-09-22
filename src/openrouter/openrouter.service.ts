import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '#config/env.config.js';
import { openrouterConfig } from './openrouter.config.js';
import { OpenrouterModelEndpoints } from './openrouter.endpoint.type.js';

type EndpointsResponse = { data: OpenrouterModelEndpoints };

@Injectable()
export class OpenrouterService {
  private readonly key?: string;
  private readonly timeoutMs: number;

  constructor(
    @Inject(HttpService) private readonly http: HttpService,
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.key = config.get('OPENROUTER_API_KEY', { infer: true });
    this.timeoutMs =
      config.get('OPENROUTER_TIMEOUT_SECONDS', { infer: true }) * 1000;
  }

  get hasKey(): boolean {
    return this.key !== undefined;
  }

  async endpoints(model: string): Promise<OpenrouterModelEndpoints> {
    const response = await this.http.axiosRef.get<EndpointsResponse>(
      `${openrouterConfig.baseUrl}/models/${model}/endpoints`,
      {
        timeout: this.timeoutMs,
        headers:
          this.key === undefined ? {} : { Authorization: `Bearer ${this.key}` },
      },
    );

    return response.data.data;
  }
}
