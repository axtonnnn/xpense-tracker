// Markdown files are bundled as plain text (wrangler.toml [[rules]], vitest.config.ts).
declare module '*.md' {
  const text: string;
  export default text;
}
