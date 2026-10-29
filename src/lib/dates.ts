// Dates are stored as local calendar days in "YYYY-MM-DD" form.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISODate(parseISODate(s)) === s;
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Adds months, clamping to the month's last day; `anchorDay` keeps a 31st-of-month bill on the 31st when possible. */
export function addMonths(iso: string, months: number, anchorDay?: number): string {
  const d = parseISODate(iso);
  const day = anchorDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  target.setDate(Math.min(day, daysInMonth(target.getFullYear(), target.getMonth())));
  return toISODate(target);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string): string {
  const d = parseISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Monday-based start of week. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const offset = (d.getDay() + 6) % 7;
  return addDays(iso, -offset);
}

export function diffDays(fromIso: string, toIso: string): number {
  return Math.round((parseISODate(toIso).getTime() - parseISODate(fromIso).getTime()) / 86_400_000);
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return parseISODate(iso).toLocaleDateString(undefined, opts);
}

export function formatMonth(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "Today, Sunday 25", "Yesterday, Saturday 24", "Friday 23": headings over a day's entries. */
export function dayHeading(iso: string, now = today()): string {
  const day = `${formatDay(iso, { weekday: 'long' })} ${parseISODate(iso).getDate()}`;
  if (iso === now) return `Today, ${day}`;
  if (iso === addDays(now, -1)) return `Yesterday, ${day}`;
  return day;
}

/** 1st, 2nd, 3rd, 28th. */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
