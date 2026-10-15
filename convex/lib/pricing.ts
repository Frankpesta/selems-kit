import type { Doc } from "../_generated/dataModel";
import { addDays, eachNight, isWeekendNight, weekday } from "../../lib/dates";

// Pricing rules (docs/04). Pure functions: no database access, easy to test.

export type NightlyLine = { date: string; rate: number; reason: string };
export type PricedStay = { nightly: NightlyLine[]; total: number; offerApplied: boolean };

type RoomTypeRates = Pick<Doc<"roomTypes">, "_id" | "baseRate" | "weekendRate">;
type Override = Pick<Doc<"rateOverrides">, "startDate" | "endDate" | "rate" | "label">;
type Offer = Pick<
  Doc<"offers">,
  "published" | "roomTypeIds" | "nights" | "validFrom" | "validTo" | "arrivalWeekdays" | "priceTotal"
>;

/** The rate for one night: special-date override, then weekend rate, then base rate. */
export function rateForNight(roomType: RoomTypeRates, overrides: Override[], night: string): NightlyLine {
  const override = overrides.find((o) => o.startDate <= night && night <= o.endDate);
  if (override) return { date: night, rate: override.rate, reason: override.label };
  if (isWeekendNight(night) && roomType.weekendRate != null) {
    return { date: night, rate: roomType.weekendRate, reason: "weekend" };
  }
  return { date: night, rate: roomType.baseRate, reason: "standard" };
}

/** Whether an offer's package price applies to this room type and stay. */
export function offerApplies(
  offer: Offer,
  roomTypeId: RoomTypeRates["_id"],
  checkIn: string,
  checkOut: string,
): boolean {
  if (!offer.published) return false;
  if (!offer.roomTypeIds.includes(roomTypeId)) return false;
  if (eachNight(checkIn, checkOut).length !== offer.nights) return false;
  if (checkIn < offer.validFrom || addDays(checkOut, -1) > offer.validTo) return false;
  const days = offer.arrivalWeekdays;
  if (days && days.length > 0 && !days.includes(weekday(checkIn))) return false;
  return true;
}

/**
 * Price a stay of nights [checkIn, checkOut). When an offer applies, its package
 * total replaces the nightly sum and is spread across nights for display, with
 * the last night absorbing the rounding.
 */
export function priceStay(
  roomType: RoomTypeRates,
  overrides: Override[],
  checkIn: string,
  checkOut: string,
  offer?: Offer | null,
): PricedStay {
  const nights = eachNight(checkIn, checkOut);
  if (offer && offerApplies(offer, roomType._id, checkIn, checkOut)) {
    const each = Math.floor(offer.priceTotal / nights.length);
    const nightly = nights.map((date, i) => ({
      date,
      rate: i === nights.length - 1 ? offer.priceTotal - each * (nights.length - 1) : each,
      reason: "offer",
    }));
    return { nightly, total: offer.priceTotal, offerApplied: true };
  }
  const nightly = nights.map((night) => rateForNight(roomType, overrides, night));
  return { nightly, total: nightly.reduce((sum, n) => sum + n.rate, 0), offerApplied: false };
}

/** Group identical nights for display: "₦70,000 × 2 nights", "₦75,000 × 1 weekend night". */
export function groupNightly(nightly: NightlyLine[]): { rate: number; reason: string; count: number }[] {
  const groups: { rate: number; reason: string; count: number }[] = [];
  for (const n of nightly) {
    const g = groups.find((x) => x.rate === n.rate && x.reason === n.reason);
    if (g) g.count++;
    else groups.push({ rate: n.rate, reason: n.reason, count: 1 });
  }
  return groups;
}
