import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Load docs/*.md as text, like the [[rules]] in wrangler.toml.
  plugins: [
    {
      name: 'markdown-as-text',
      transform: (code, id) => (id.endsWith('.md') ? { code: `export default ${JSON.stringify(code)};`, map: null } : undefined),
    },
  ],
  resolve: {
    // shared/schemas.ts lives outside this package; use this package's zod (same as wrangler.toml [alias]).
    alias: { zod: fileURLToPath(new URL('./node_modules/zod', import.meta.url)) },
  },
  test: { environment: 'node' },
});
