import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // shared/schemas.ts lives outside this package; use this package's zod (same as wrangler.toml [alias]).
    alias: { zod: fileURLToPath(new URL('./node_modules/zod', import.meta.url)) },
  },
  test: { environment: 'node' },
});
