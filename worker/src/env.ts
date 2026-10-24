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
  /** Pro fair-use caps per calendar month. */
  PRO_MONTHLY_SCANS?: string;
  PRO_MONTHLY_CHECKS?: string;
  PRO_MONTHLY_REVIEWS?: string;
  /** Local development only: treat every install as Pro. Never set this in production. */
  ALLOW_ALL_PRO?: string;
  /** Shown on the privacy policy, terms and support pages (src/pages.ts). */
  OWNER_NAME?: string;
  CONTACT_EMAIL?: string;
  GOVERNING_LAW?: string;
  LAST_UPDATED?: string;
  /** Optional: the App Store link, shown as a button on the home page once the app is live. */
  APP_STORE_URL?: string;
}
