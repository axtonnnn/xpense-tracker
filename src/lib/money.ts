// All money is stored as integer cents (minor units) to avoid floating-point drift.

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'MXN', 'BRL', 'NGN', 'ZAR', 'PHP'];

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Parses user input such as "12", "12.5", "1,234.56" or "12,50" into cents. Returns null if invalid. */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/[^\d.,-]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // "1.234,56" or "12,50": comma is the decimal separator if followed by 1-2 digits
    const decimals = s.length - lastComma - 1;
    s = decimals <= 2 ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return toCents(n);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: compact ? 0 : 2,
        minimumFractionDigits: compact ? 0 : undefined,
      });
    } catch {
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: compact ? 0 : 2 });
    }
    formatters.set(key, f);
  }
  return f;
}

export function formatMoney(cents: number, currency: string, opts: { compact?: boolean } = {}): string {
  return formatter(currency, !!opts.compact).format(fromCents(cents));
}

/** The symbol the locale uses for a currency ("$", "€", "₹"), or the code when it has none. */
export function currencySymbol(currency: string): string {
  return formatMoney(0, currency, { compact: true }).replace(/[\d\s.,]/g, '') || currency;
}

/** Short axis labels: $1.2k, $950. */
export function formatAxis(cents: number, currency: string): string {
  const major = cents / 100;
  if (Math.abs(major) >= 1000) {
    const k = major / 1000;
    return `${currencySymbol(currency)}${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return formatMoney(cents, currency, { compact: true });
}

/** Cents → editable string like "12.50" (no currency symbol). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
