// Calendar-date helpers shared by Next.js and Convex (docs/04).
//
// Business dates are "YYYY-MM-DD" strings in Africa/Lagos time (UTC+1, no DST).
// A stay covers the nights [checkIn, checkOut). All arithmetic happens on UTC
// midnight values, so local machine time zones never leak into business rules.
// Do not use `new Date()` arithmetic for business rules anywhere else.

const DAY_MS = 86_400_000;
const LAGOS_OFFSET_MS = 3_600_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-24" → UTC midnight in ms. */
export const parse = (d: string): number => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};

/** UTC ms → "YYYY-MM-DD". */
export const fmt = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** True for a real calendar date in strict "YYYY-MM-DD" form (rejects 2026-02-30). */
export const isDateString = (d: string): boolean => {
  const m = DATE_RE.exec(d);
  if (!m) return false;
  return fmt(parse(d)) === d;
};

export const addDays = (d: string, n: number): string => fmt(parse(d) + n * DAY_MS);

export const nightsBetween = (a: string, b: string): number =>
  Math.round((parse(b) - parse(a)) / DAY_MS);

/** Every night of a stay: eachNight("2026-10-24", "2026-10-26") → ["2026-10-24", "2026-10-25"]. */
export const eachNight = (a: string, b: string): string[] =>
  Array.from({ length: Math.max(0, nightsBetween(a, b)) }, (_, i) => addDays(a, i));

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (d: string): number => new Date(parse(d)).getUTCDay();

/** Friday and Saturday nights take the weekend rate. */
export const isWeekendNight = (d: string): boolean => {
  const w = weekday(d);
  return w === 5 || w === 6;
};

/** Today's date in Lagos. */
export const todayLagos = (now: number = Date.now()): string =>
  fmt(now + LAGOS_OFFSET_MS - ((now + LAGOS_OFFSET_MS) % DAY_MS));

/** Current Lagos wall-clock time as "HH:mm". */
export const nowLagosHHmm = (now: number = Date.now()): string =>
  new Date(now + LAGOS_OFFSET_MS).toISOString().slice(11, 16);

/** Compare "YYYY-MM-DD" strings (lexicographic order is chronological). */
export const compareDates = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** True when two stays share at least one night. Adjacent stays (a.checkOut === b.checkIn) do not overlap. */
export const staysOverlap = (
  a: { checkIn: string; checkOut: string },
  b: { checkIn: string; checkOut: string },
): boolean => a.checkIn < b.checkOut && b.checkIn < a.checkOut;
