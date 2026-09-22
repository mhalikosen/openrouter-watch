import { OpenrouterModelEndpoints } from '#openrouter/openrouter.endpoint.type.js';
import {
  PriceField,
  SpeedField,
  WatchChange,
  WatchedEndpoint,
  WatchedModel,
} from './watch.snapshot.type.js';

const PRICE_FIELDS: PriceField[] = ['prompt', 'completion'];

const SPEED_FIELDS: SpeedField[] = ['throughput', 'latency'];

const uniqueKeys = (tags: string[]): string[] => {
  const seen = new Map<string, number>();

  return tags.map((tag) => {
    const count = (seen.get(tag) ?? 0) + 1;
    seen.set(tag, count);

    return count === 1 ? tag : `${tag}#${count}`;
  });
};

export const toWatchedModel = (
  source: OpenrouterModelEndpoints,
  model: string,
  takenAt: string,
): WatchedModel => {
  const keys = uniqueKeys(source.endpoints.map((endpoint) => endpoint.tag));

  return {
    model,
    id: source.id,
    takenAt,
    endpoints: source.endpoints.map((endpoint, index) => ({
      key: keys[index] ?? endpoint.tag,
      provider: endpoint.provider_name,
      quantization: endpoint.quantization,
      prompt: endpoint.pricing.prompt,
      completion: endpoint.pricing.completion,
      throughput: endpoint.throughput_last_30m?.p50 ?? null,
      latency: endpoint.latency_last_30m?.p50 ?? null,
    })),
  };
};

const priceChanges = (
  before: WatchedEndpoint,
  after: WatchedEndpoint,
): WatchChange[] =>
  PRICE_FIELDS.filter((field) => before[field] !== after[field]).map(
    (field) => ({
      kind: 'price',
      endpoint: after,
      field,
      before: before[field],
      after: after[field],
    }),
  );

const percentChange = (before: number, after: number): number =>
  ((after - before) / before) * 100;

const speedChanges = (
  before: WatchedEndpoint,
  after: WatchedEndpoint,
  thresholdPercent: number,
): WatchChange[] =>
  SPEED_FIELDS.flatMap((field) => {
    const previous = before[field];
    const current = after[field];

    if (previous === null || current === null || previous === 0) return [];

    const percent = percentChange(previous, current);

    if (Math.abs(percent) < thresholdPercent) return [];

    return [
      {
        kind: 'speed' as const,
        endpoint: after,
        field,
        before: previous,
        after: current,
        percent,
      },
    ];
  });

export const compareWatchedModels = (
  before: WatchedModel,
  after: WatchedModel,
  thresholdPercent: number,
): WatchChange[] => {
  const previous = new Map(before.endpoints.map((e) => [e.key, e]));
  const current = new Map(after.endpoints.map((e) => [e.key, e]));
  const changes: WatchChange[] = [];

  for (const endpoint of after.endpoints) {
    const earlier = previous.get(endpoint.key);

    if (earlier === undefined) {
      changes.push({ kind: 'appeared', endpoint });
      continue;
    }

    changes.push(...priceChanges(earlier, endpoint));
    changes.push(...speedChanges(earlier, endpoint, thresholdPercent));
  }

  for (const endpoint of before.endpoints) {
    if (!current.has(endpoint.key)) {
      changes.push({ kind: 'disappeared', endpoint });
    }
  }

  return changes;
};
