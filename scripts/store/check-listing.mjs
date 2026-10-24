// Checks the copy in docs/app-store/listing.md against App Store Connect's length limits.
//
//   npm run store:check
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const listing = readFileSync(join(ROOT, 'docs', 'app-store', 'listing.md'), 'utf8');

/** The first ```text block after the line that starts with `label`. */
function field(label) {
  const start = listing.indexOf(label);
  if (start < 0) throw new Error(`"${label}" not found in listing.md`);
  return /```text\n([\s\S]*?)\n```/.exec(listing.slice(start))[1];
}

/** A cell from the subscriptions table, e.g. row "Description", column 1 or 2. */
function cell(row, column) {
  const line = listing.split('\n').find((l) => l.startsWith(`| ${row} |`));
  return line.split('|')[column + 1].trim().replace(/^`|`$/g, '');
}

const checks = [
  ['Name', field('**Name**'), 30],
  ['Subtitle', field('**Subtitle**'), 30],
  ['Promotional text', field('**Promotional text**'), 170],
  ['Description', field('**Description**'), 4000],
  ['Keywords', field('**Keywords**'), 100],
  ['Review notes', field('**Notes**'), 4000],
  ['Monthly display name', cell('Display name', 1), 30],
  ['Yearly display name', cell('Display name', 2), 30],
  ['Monthly description', cell('Description', 1), 45],
  ['Yearly description', cell('Description', 2), 45],
];

let failed = 0;
for (const [name, text, max] of checks) {
  // App Store Connect counts characters; keywords are limited in bytes, so count those as UTF-8.
  const length = name === 'Keywords' ? Buffer.byteLength(text) : [...text].length;
  const okay = length <= max;
  if (!okay) failed++;
  console.log(`${okay ? '✔' : '✖'} ${name}: ${length}/${max}`);
}
if (/, /.test(field('**Keywords**'))) {
  failed++;
  console.log('✖ Keywords: remove the spaces after commas (they count against the limit)');
}
process.exitCode = failed ? 1 : 0;
