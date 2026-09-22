import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OpenrouterModelEndpoints } from '#openrouter/openrouter.endpoint.type.js';
import { compareWatchedModels, toWatchedModel } from './watch.diff.util.js';
import { WatchedEndpoint, WatchedModel } from './watch.snapshot.type.js';

const endpoint = (
  overrides: Partial<WatchedEndpoint> = {},
): WatchedEndpoint => ({
  key: 'deepinfra/fp8',
  provider: 'DeepInfra',
  quantization: 'fp8',
  prompt: '0.00000014',
  completion: '0.00000042',
  throughput: 45,
  latency: 1708,
  ...overrides,
});

const model = (endpoints: WatchedEndpoint[], takenAt = 't0'): WatchedModel => ({
  model: 'deepseek/deepseek-v4.1-flash-20260910',
  id: 'deepseek/deepseek-v4.1-flash',
  takenAt,
  endpoints,
});

await describe('compareWatchedModels', async () => {
  await it('reports nothing when nothing moved', () => {
    const before = model([endpoint()]);
    const after = model([endpoint()], 't1');

    assert.deepEqual(compareWatchedModels(before, after, 25), []);
  });

  await it('reports every price move, however small', () => {
    const before = model([endpoint()]);
    const after = model([endpoint({ completion: '0.00000043' })], 't1');

    const changes = compareWatchedModels(before, after, 25);

    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0], {
      kind: 'price',
      endpoint: after.endpoints[0],
      field: 'completion',
      before: '0.00000042',
      after: '0.00000043',
    });
  });

  await it('reports a speed move only past the threshold', () => {
    const before = model([endpoint()]);
    const quiet = model([endpoint({ throughput: 50 })], 't1');
    const loud = model([endpoint({ throughput: 20, latency: 3000 })], 't1');

    assert.deepEqual(compareWatchedModels(before, quiet, 25), []);

    const changes = compareWatchedModels(before, loud, 25);

    assert.equal(changes.length, 2);
    assert.equal(changes[0]?.kind, 'speed');
    assert.equal(changes[1]?.kind, 'speed');
    if (changes[0]?.kind === 'speed') {
      assert.equal(changes[0].field, 'throughput');
      assert.equal(Math.round(changes[0].percent), -56);
    }
    if (changes[1]?.kind === 'speed') {
      assert.equal(changes[1].field, 'latency');
      assert.equal(Math.round(changes[1].percent), 76);
    }
  });

  await it('stays quiet on speed when either side has no figure', () => {
    const before = model([endpoint({ throughput: null })]);
    const after = model([endpoint({ throughput: 90 })], 't1');

    assert.deepEqual(compareWatchedModels(before, after, 25), []);
  });

  await it('reports endpoints that appeared and disappeared', () => {
    const before = model([
      endpoint(),
      endpoint({ key: 'gone', provider: 'Gone' }),
    ]);
    const after = model(
      [endpoint(), endpoint({ key: 'new', provider: 'New' })],
      't1',
    );

    const changes = compareWatchedModels(before, after, 25);

    assert.deepEqual(
      changes.map((change) => [change.kind, change.endpoint.key]),
      [
        ['appeared', 'new'],
        ['disappeared', 'gone'],
      ],
    );
  });
});

await describe('toWatchedModel', async () => {
  await it('keeps duplicate tags apart and takes the p50 of each speed figure', () => {
    const source: OpenrouterModelEndpoints = {
      id: 'deepseek/deepseek-v4.1-flash',
      name: 'DeepSeek V4.1 Flash',
      endpoints: [
        {
          name: 'BaseTen | a',
          tag: 'baseten/fp8',
          provider_name: 'BaseTen',
          quantization: 'fp8',
          context_length: 1,
          status: 0,
          uptime_last_30m: 100,
          throughput_last_30m: { p50: 40, p75: 50, p90: 60, p99: 70 },
          latency_last_30m: null,
          pricing: { prompt: '0.0000003', completion: '0.0000012' },
        },
        {
          name: 'BaseTen | b',
          tag: 'baseten/fp8',
          provider_name: 'BaseTen',
          quantization: 'fp8',
          context_length: 1,
          status: 0,
          uptime_last_30m: 100,
          throughput_last_30m: null,
          latency_last_30m: { p50: 900, p75: 1000, p90: 1100, p99: 1200 },
          pricing: { prompt: '0.0000003', completion: '0.0000012' },
        },
      ],
    };

    const watched = toWatchedModel(
      source,
      'deepseek/deepseek-v4.1-flash-20260910',
      't0',
    );

    assert.equal(watched.model, 'deepseek/deepseek-v4.1-flash-20260910');
    assert.equal(watched.id, 'deepseek/deepseek-v4.1-flash');
    assert.deepEqual(
      watched.endpoints.map((e) => [e.key, e.throughput, e.latency]),
      [
        ['baseten/fp8', 40, null],
        ['baseten/fp8#2', null, 900],
      ],
    );
  });
});
