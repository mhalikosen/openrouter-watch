export type OpenrouterPercentiles = {
  p50: number;
  p75: number;
  p90: number;
  p99: number;
};

export type OpenrouterPricing = {
  prompt: string;
  completion: string;
  input_cache_read?: string;
  discount?: number;
};

export type OpenrouterEndpoint = {
  name: string;
  tag: string;
  provider_name: string;
  quantization: string | null;
  context_length: number | null;
  status: number;
  uptime_last_30m: number | null;
  throughput_last_30m: OpenrouterPercentiles | null;
  latency_last_30m: OpenrouterPercentiles | null;
  pricing: OpenrouterPricing;
};

export type OpenrouterModelEndpoints = {
  id: string;
  name: string;
  endpoints: OpenrouterEndpoint[];
};
