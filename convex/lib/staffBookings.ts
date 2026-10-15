import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { addDays, eachNight, isDateString, nightsBetween } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import { appError } from "./errors";
import { bestPrice, offersForStay, overridesForStay } from "./stays";
import { MAX_NAME, isValidEmail, normaliseEmail, normalisePhone } from "./validators";

// Rules for bookings made and changed by staff (docs/04 "Rules for staff writes").
// Staff are not bound by the online limits (max nights, booking window), but a
// new stay can't start before yesterday: a guest arriving after midnight is
// booked for the night that has just begun.

export const STAFF_MAX_NIGHTS = 365;

export function validateStaffStay(
  stay: { checkIn: string; checkOut: string },
  today: string,
  opts: { allowPastCheckIn?: boolean } = {},
): number {
  const { checkIn, checkOut } = stay;
  if (!isDateString(checkIn) || !isDateString(checkOut)) {
    throw appError("INVALID_DATES", "Choose valid check-in and check-out dates.");
  }
  if (!opts.allowPastCheckIn && checkIn < addDays(today, -1)) {
    throw appError("INVALID_DATES", "Check-in can't be more than a day in the past.", "checkIn");
  }
  if (checkOut <= checkIn) throw appError("INVALID_DATES", "Check-out must be after check-in.", "checkOut");
  const nights = nightsBetween(checkIn, checkOut);
  if (nights > STAFF_MAX_NIGHTS) {
    throw appError("INVALID_DATES", `A booking can be at most ${STAFF_MAX_NIGHTS} nights.`, "checkOut");
  }
  return nights;
}

/** Guest details for a staff booking: email is optional (walk-ins, phone bookings). */
export function validateStaffGuest(guest: { firstName: string; lastName: string; email?: string; phone: string }) {
  const clean = (s: string) => s.trim().replace(/\s+/g, " ");
  const firstName = clean(guest.firstName);
  const lastName = clean(guest.lastName);
  if (!firstName || firstName.length > MAX_NAME) throw appError("INVALID_INPUT", "Enter the guest's first name.", "firstName");
  if (!lastName || lastName.length > MAX_NAME) throw appError("INVALID_INPUT", "Enter the guest's last name.", "lastName");
  const emailRaw = guest.email?.trim() ?? "";
  if (emailRaw && !isValidEmail(emailRaw)) throw appError("INVALID_INPUT", "Enter a valid email address, or leave it blank.", "email");
  const phone = normalisePhone(guest.phone);
  if (!phone) throw appError("INVALID_INPUT", "Enter a valid phone number.", "phone");
  return { firstName, lastName, email: emailRaw ? normaliseEmail(emailRaw) : "", phone };
}

export function validatePartySize(party: { adults: number; children: number }) {
  if (!Number.isInteger(party.adults) || party.adults < 1 || party.adults > 20) {
    throw appError("INVALID_INPUT", "Enter the number of adults.", "adults");
  }
  if (!Number.isInteger(party.children) || party.children < 0 || party.children > 20) {
    throw appError("INVALID_INPUT", "Enter the number of children.", "children");
  }
}

export function assertKoboAmount(amount: number, field: string, label = "amount") {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 100_000_000_00) {
    throw appError("INVALID_INPUT", `Enter a valid ${label}.`, field);
  }
}

export const MANUAL_REASON = "manual";

/** Nightly lines at one manual rate (staff rate override). */
export const manualNightly = (checkIn: string, checkOut: string, rate: number) =>
  eachNight(checkIn, checkOut).map((date) => ({ date, rate, reason: MANUAL_REASON }));

export const isManuallyPriced = (b: Pick<Doc<"bookings">, "nightly">) =>
  b.nightly.length > 0 && b.nightly.every((n) => n.reason === MANUAL_REASON);

/** The website price for a stay, used for staff bookings without an override. */
export async function standardPrice(ctx: QueryCtx, roomType: Doc<"roomTypes">, checkIn: string, checkOut: string) {
  const overrides = await overridesForStay(ctx, roomType._id, checkIn, checkOut);
  const offers = await offersForStay(ctx, checkIn, checkOut);
  return bestPrice(roomType, overrides, offers, checkIn, checkOut);
}

/** The first night the room is taken by someone else, or null if it is free for the whole stay. */
export async function firstClash(
  ctx: QueryCtx,
  roomId: Id<"rooms">,
  checkIn: string,
  checkOut: string,
  ignoreBookingId?: Id<"bookings">,
): Promise<{ date: string; ref: string | null; blocked: boolean } | null> {
  for (const date of eachNight(checkIn, checkOut)) {
    const rows = await ctx.db
      .query("occupancy")
      .withIndex("by_room_date", (q) => q.eq("roomId", roomId).eq("date", date))
      .collect();
    const other = rows.find((r) => !(ignoreBookingId && r.bookingId === ignoreBookingId));
    if (other) {
      const booking = other.bookingId ? await ctx.db.get(other.bookingId) : null;
      return { date, ref: booking?.ref ?? null, blocked: !!other.blockId };
    }
  }
  return null;
}

/** Throws CONFLICT with a message the front desk can act on unless the room is free. */
export async function assertRoomFree(
  ctx: QueryCtx,
  room: Doc<"rooms">,
  checkIn: string,
  checkOut: string,
  ignoreBookingId?: Id<"bookings">,
) {
  if (room.status !== "active") {
    throw appError("CONFLICT", `Room ${room.number} is out of service. Choose another room.`, "roomId");
  }
  const clash = await firstClash(ctx, room._id, checkIn, checkOut, ignoreBookingId);
  if (clash) {
    const what = clash.blocked ? "blocked" : clash.ref ? `taken by ${clash.ref}` : "taken";
    throw appError("CONFLICT", `Room ${room.number} is ${what} on the night of ${clash.date}. Choose another room.`, "roomId");
  }
}

export const balanceOf = (b: Pick<Doc<"bookings">, "amountDue" | "amountPaid">) => Math.max(0, b.amountDue - b.amountPaid);

export const naira = formatNaira;

/** Loads a booking for a staff write or throws NOT_FOUND. */
export async function loadBooking(ctx: QueryCtx | MutationCtx, id: Id<"bookings">) {
  const booking = await ctx.db.get(id);
  if (!booking) throw appError("NOT_FOUND", "That booking doesn't exist.");
  return booking;
}
