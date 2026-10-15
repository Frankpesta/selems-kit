import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { addDays } from "../../lib/dates";
import { appError } from "./errors";
import { offerApplies, priceStay, type PricedStay } from "./pricing";

// Loaders shared by search, quote and the booking transaction, so a guest is
// always shown exactly the price the booking will be created at.

export async function getSettings(ctx: QueryCtx): Promise<Doc<"settings">> {
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "hotel"))
    .unique();
  if (!settings) throw new Error("Hotel settings are missing. Run `npx convex run seed:all`.");
  return settings;
}

export async function publishedRoomTypeBySlug(ctx: QueryCtx, slug: string): Promise<Doc<"roomTypes">> {
  const roomType = await ctx.db
    .query("roomTypes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!roomType || !roomType.published) throw appError("NOT_FOUND", "That room isn't available to book.");
  return roomType;
}

/** Special-date rates for a room type that touch any night of the stay. */
export async function overridesForStay(
  ctx: QueryCtx,
  roomTypeId: Doc<"roomTypes">["_id"],
  checkIn: string,
  checkOut: string,
) {
  const lastNight = addDays(checkOut, -1);
  const rows = await ctx.db
    .query("rateOverrides")
    .withIndex("by_type_start", (q) => q.eq("roomTypeId", roomTypeId).lte("startDate", lastNight))
    .collect();
  return rows.filter((o) => o.endDate >= checkIn);
}

/** Published offers whose stay window overlaps the stay. */
export async function offersForStay(ctx: QueryCtx, checkIn: string, checkOut: string) {
  const offers = await ctx.db.query("offers").collect();
  return offers.filter((o) => o.published && o.validFrom <= addDays(checkOut, -1) && o.validTo >= checkIn);
}

export type StayPrice = PricedStay & { offer: Doc<"offers"> | null };

/**
 * Price a stay for one room type. Any published offer the stay qualifies for
 * is applied automatically when it is cheaper than the nightly rates.
 */
export function bestPrice(
  roomType: Doc<"roomTypes">,
  overrides: Doc<"rateOverrides">[],
  offers: Doc<"offers">[],
  checkIn: string,
  checkOut: string,
): StayPrice {
  let best: StayPrice = { ...priceStay(roomType, overrides, checkIn, checkOut), offer: null };
  for (const offer of offers) {
    if (!offerApplies(offer, roomType._id, checkIn, checkOut)) continue;
    const priced = priceStay(roomType, overrides, checkIn, checkOut, offer);
    if (priced.total < best.total) best = { ...priced, offer };
  }
  return best;
}
