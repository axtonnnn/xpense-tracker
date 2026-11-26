// Reading the phone's locale tag. Tags can carry extensions after the language and region, e.g.
// "en-GB-u-hc-h23" (24-hour clock) or "de-DE-u-ca-gregory-nu-latn", so the last part is not
// always the region, and the whole tag can be long.

/** The tag without extensions or private-use parts: "en-GB-u-hc-h23" → "en-GB". */
export function baseLocale(tag: string): string {
  const parts = tag.split(/[-_]/).filter(Boolean);
  const singleton = parts.findIndex((p, i) => i > 0 && p.length === 1);
  return (singleton === -1 ? parts : parts.slice(0, singleton)).join('-');
}

/** The region in a locale tag, upper-cased ("GB", "419"), or null when it has none: "en-GB-u-fw-mon" → "GB". */
export function localeRegion(tag: string): string | null {
  const [, ...rest] = baseLocale(tag).split('-');
  const region = rest.find((p) => /^([A-Za-z]{2}|\d{3})$/.test(p));
  return region ? region.toUpperCase() : null;
}

/** The phone's locale, short enough for the AI request (it allows 35 characters). */
export function requestLocale(tag: string | undefined): string {
  const base = baseLocale(tag ?? '');
  return base && base.length <= 35 ? base : 'en-US';
}
