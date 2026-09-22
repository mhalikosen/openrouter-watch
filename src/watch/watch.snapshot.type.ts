export type WatchedEndpoint = {
  key: string;
  provider: string;
  quantization: string | null;
  prompt: string;
  completion: string;
  throughput: number | null;
  latency: number | null;
};

export type WatchedModel = {
  model: string;
  id: string;
  takenAt: string;
  endpoints: WatchedEndpoint[];
};

export type PriceField = 'prompt' | 'completion';

export type SpeedField = 'throughput' | 'latency';

export type WatchChange =
  | { kind: 'appeared'; endpoint: WatchedEndpoint }
  | { kind: 'disappeared'; endpoint: WatchedEndpoint }
  | {
      kind: 'price';
      endpoint: WatchedEndpoint;
      field: PriceField;
      before: string;
      after: string;
    }
  | {
      kind: 'speed';
      endpoint: WatchedEndpoint;
      field: SpeedField;
      before: number;
      after: number;
      percent: number;
    };

export type WatchModelReport = {
  model: string;
  before: WatchedModel;
  after: WatchedModel;
  changes: WatchChange[];
};
