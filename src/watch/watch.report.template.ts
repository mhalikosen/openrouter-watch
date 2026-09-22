import {
  WatchChange,
  WatchedEndpoint,
  WatchModelReport,
} from './watch.snapshot.type.js';

const perMillion = (perToken: string): string => {
  const value = Number(perToken) * 1_000_000;
  const text = value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

  return `$${text}/M`;
};

const integer = (value: number): string =>
  Math.round(value).toLocaleString('en-US');

const signedPercent = (percent: number): string =>
  `${percent > 0 ? '+' : ''}${Math.round(percent)}%`;

const speedValue = (field: 'throughput' | 'latency', value: number) =>
  field === 'throughput' ? `${integer(value)} tok/s` : `${integer(value)} ms`;

const label = (endpoint: WatchedEndpoint): string =>
  endpoint.quantization === null || endpoint.quantization === 'unknown'
    ? endpoint.provider
    : `${endpoint.provider} (${endpoint.quantization})`;

const KIND_ORDER: WatchChange['kind'][] = [
  'price',
  'speed',
  'appeared',
  'disappeared',
];

const byKind = (a: WatchChange, b: WatchChange) =>
  KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);

const line = (change: WatchChange): string => {
  const who = label(change.endpoint).padEnd(24);

  switch (change.kind) {
    case 'price':
      return `  price  ${who} ${change.field.padEnd(11)} ${perMillion(change.before)} -> ${perMillion(change.after)}`;
    case 'speed':
      return `  speed  ${who} ${change.field.padEnd(11)} ${speedValue(change.field, change.before)} -> ${speedValue(change.field, change.after)} (${signedPercent(change.percent)})`;
    case 'appeared':
      return `  new    ${who} ${perMillion(change.endpoint.prompt)} prompt, ${perMillion(change.endpoint.completion)} completion`;
    case 'disappeared':
      return `  gone   ${label(change.endpoint)}`;
  }
};

const count = (reports: WatchModelReport[], kind: WatchChange['kind']) =>
  reports.reduce(
    (total, report) =>
      total + report.changes.filter((change) => change.kind === kind).length,
    0,
  );

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const renderSubject = (reports: WatchModelReport[]): string => {
  const parts = [
    [count(reports, 'price'), 'price change'],
    [count(reports, 'speed'), 'speed change'],
    [count(reports, 'appeared'), 'new endpoint'],
    [count(reports, 'disappeared'), 'endpoint gone'],
  ] as const;
  const named = parts
    .filter(([n]) => n > 0)
    .map(([n, word]) =>
      word === 'endpoint gone'
        ? `${n} endpoint${n === 1 ? '' : 's'} gone`
        : plural(n, word),
    );

  return `OpenRouter watch: ${named.join(', ')}`;
};

export const renderText = (reports: WatchModelReport[]): string =>
  reports
    .filter((report) => report.changes.length > 0)
    .map((report) =>
      [
        report.model,
        `  ${report.before.takenAt} -> ${report.after.takenAt}`,
        '',
        ...[...report.changes].sort(byKind).map(line),
      ].join('\n'),
    )
    .join('\n\n');
