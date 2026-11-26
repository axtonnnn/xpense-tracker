import { describe, expect, it } from '@jest/globals';

import { ScanRequestSchema } from '../../../shared/schemas';
import { baseLocale, localeRegion, requestLocale } from '../locale';

describe('locale tags', () => {
  it('drops extensions after the language and region', () => {
    expect(baseLocale('en-GB-u-hc-h23')).toBe('en-GB');
    expect(baseLocale('de-DE-u-ca-gregory-nu-latn')).toBe('de-DE');
    expect(baseLocale('en-US-x-private')).toBe('en-US');
    expect(baseLocale('zh-Hans-CN')).toBe('zh-Hans-CN');
    expect(baseLocale('en_GB')).toBe('en-GB');
  });

  it('finds the region even when extensions follow it', () => {
    expect(localeRegion('en-US')).toBe('US');
    expect(localeRegion('en-GB-u-fw-mon')).toBe('GB');
    expect(localeRegion('en-GB-u-hc-h23')).toBe('GB');
    expect(localeRegion('fr-fr')).toBe('FR');
    expect(localeRegion('zh-Hans-CN')).toBe('CN');
    expect(localeRegion('es-419')).toBe('419');
  });

  it('has no region for a language alone', () => {
    expect(localeRegion('de')).toBeNull();
    expect(localeRegion('en-u-ca-gregory')).toBeNull();
    expect(localeRegion('')).toBeNull();
  });

  it('always sends a locale the scan request accepts', () => {
    const scan = (locale: string) =>
      ScanRequestSchema.safeParse({ image_base64: 'x'.repeat(100), media_type: 'image/jpeg', currency: 'USD', locale, today: '2026-11-17' })
        .success;
    const long = 'en-US-u-ca-gregory-fw-mon-hc-h23-mu-celsius-nu-latn';
    expect(scan(long)).toBe(false); // what used to be sent
    expect(requestLocale(long)).toBe('en-US');
    expect(scan(requestLocale(long))).toBe(true);
    expect(requestLocale(undefined)).toBe('en-US');
    expect(requestLocale('')).toBe('en-US');
    expect(requestLocale('pt-BR')).toBe('pt-BR');
  });
});
