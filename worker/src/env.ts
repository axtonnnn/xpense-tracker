// Minimal shapes of the Cloudflare bindings we use, so tests can pass in simple fakes.
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** Secret: `wrangler secret put ANTHROPIC_API_KEY` */
  ANTHROPIC_API_KEY: string;
  /** Secret: RevenueCat secret API key (v1), used to confirm Pro subscriptions. */
  REVENUECAT_SECRET_KEY?: string;
  /** Your Supabase project URL, e.g. https://abcd1234.supabase.co. Sign-in tokens are checked against it. */
  SUPABASE_URL?: string;
  /** Secret: the project's secret key (sb_secret_…, or the legacy service_role key), used only to delete accounts. */
  SUPABASE_SECRET_KEY?: string;
  /** Secret, older projects only: the legacy JWT secret, if the project still signs tokens with it. */
  SUPABASE_JWT_SECRET?: string;
  /** Local development only (`wrangler dev` without Supabase): treat unsigned requests as this account. */
  DEV_USER_ID?: string;
  /** KV namespace for trial counters, monthly fair-use counters and cached Pro status. */
  USAGE: KV;
  /** Optional Workers rate-limit binding for burst protection. */
  BURST_LIMITER?: RateLimiter;
  FREE_TRIAL_SCANS?: string;
  /** Pro fair-use caps per calendar month. */
  PRO_MONTHLY_SCANS?: string;
  PRO_MONTHLY_CHECKS?: string;
  PRO_MONTHLY_REVIEWS?: string;
  /** Local development only: treat every account as Pro. Never set this in production. */
  ALLOW_ALL_PRO?: string;
  /** Shown on the privacy policy, terms and support pages (src/pages.ts). */
  OWNER_NAME?: string;
  CONTACT_EMAIL?: string;
  GOVERNING_LAW?: string;
  LAST_UPDATED?: string;
  /** Optional: the store links, shown as download buttons on the home page once the app is live. */
  APP_STORE_URL?: string;
  PLAY_STORE_URL?: string;
  /** Optional: Pro's prices as the home page shows them, e.g. "$2.99 a month or $19.99 a year". */
  PRO_PRICES?: string;
}
