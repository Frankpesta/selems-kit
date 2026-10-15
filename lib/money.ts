// Money helpers shared by Next.js and Convex.
// All amounts are stored as integer kobo: ₦70,000 = 7_000_000. Never floats.

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export const KOBO_PER_NAIRA = 100;

export const isKobo = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** Throws unless `n` is a non-negative integer number of kobo. */
export function assertKobo(n: number, label = "amount"): number {
  if (!isKobo(n)) throw new Error(`${label} must be a non-negative integer number of kobo`);
  return n;
}

export const nairaToKobo = (naira: number): number => Math.round(naira * KOBO_PER_NAIRA);

export const koboToNaira = (kobo: number): number => kobo / KOBO_PER_NAIRA;

/** 7_000_000 → "₦70,000". */
export const formatNaira = (kobo: number): string => nairaFormatter.format(koboToNaira(kobo));

/**
 * Parse what staff type into a price field: "70000", "70,000", "₦70,000", "N70,000.50".
 * Returns kobo, or null if the input is not a price.
 */
export function parseNairaInput(input: string): number | null {
  const cleaned = input.trim().replace(/^(₦|NGN|N)\s*/i, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * KOBO_PER_NAIRA + Number(frac.padEnd(2, "0"));
}
