// Minimal shapes of the Cloudflare bindings we use, so tests can pass in simple fakes.
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** Secret: `wrangler secret put ANTHROPIC_API_KEY` */
  ANTHROPIC_API_KEY: string;
  /** Secret: RevenueCat secret API key (v1), used to confirm Pro subscriptions. */
  REVENUECAT_SECRET_KEY?: string;
  /** KV namespace for trial counters, monthly fair-use counters and cached Pro status. */
  USAGE: KV;
  /** Optional Workers rate-limit binding for burst protection. */
  BURST_LIMITER?: RateLimiter;
  FREE_TRIAL_SCANS?: string;
  PRO_MONTHLY_SCANS?: string;
  /** Local development only: treat every install as Pro. Never set this in production. */
  ALLOW_ALL_PRO?: string;
}
