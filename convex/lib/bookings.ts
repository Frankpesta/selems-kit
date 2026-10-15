import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { eachNight, parse } from "../../lib/dates";

// Helpers for writing bookings. Every booking write goes through these so
// occupancy, history and the search key stay consistent.

const LAGOS_OFFSET_MS = 3_600_000;

/** "HH:mm" → minutes after midnight. */
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** The moment (UTC ms) a stay's check-in begins: check-in time on the arrival day in Lagos, or midnight if unset. */
export function checkInInstant(checkIn: string, checkInTime?: string): number {
  const midnightLagos = parse(checkIn) - LAGOS_OFFSET_MS;
  return midnightLagos + (checkInTime ? minutesOf(checkInTime) * 60_000 : 0);
}

/**
 * Last moment a guest may cancel online: `freeCancellationHours` before check-in.
 * With no policy set, guests may cancel online up to check-in time.
 */
export function guestCancelDeadline(
  checkIn: string,
  settings: Pick<Doc<"settings">, "checkInTime" | "freeCancellationHours">,
): number {
  const hours = settings.freeCancellationHours ?? 0;
  return checkInInstant(checkIn, settings.checkInTime) - hours * 3_600_000;
}

export const canGuestCancel = (
  booking: Pick<Doc<"bookings">, "status" | "checkIn">,
  settings: Pick<Doc<"settings">, "checkInTime" | "freeCancellationHours">,
  now: number,
) => booking.status === "reserved" && now < guestCancelDeadline(booking.checkIn, settings);

/** Marks the room taken for every night of the stay. */
export async function occupyNights(
  ctx: MutationCtx,
  bookingId: Id<"bookings">,
  roomId: Id<"rooms">,
  checkIn: string,
  checkOut: string,
) {
  for (const date of eachNight(checkIn, checkOut)) {
    await ctx.db.insert("occupancy", { roomId, date, bookingId });
  }
}

/** Frees a booking's nights; with `from`, only nights on or after that date (early checkout). */
export async function releaseNights(ctx: MutationCtx, bookingId: Id<"bookings">, from?: string) {
  const rows = await ctx.db
    .query("occupancy")
    .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
    .collect();
  for (const row of rows) {
    if (from && row.date < from) continue;
    await ctx.db.delete(row._id);
  }
}

export async function addBookingEvent(
  ctx: MutationCtx,
  bookingId: Id<"bookings">,
  type: string,
  message: string,
  by?: Id<"users">,
) {
  await ctx.db.insert("bookingEvents", { bookingId, type, message, by, at: Date.now() });
}

export const paymentStatusFor = (amountDue: number, amountPaid: number): Doc<"bookings">["paymentStatus"] =>
  amountPaid <= 0 ? "unpaid" : amountPaid >= amountDue ? "paid" : "part_paid";
