import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { todayLagos } from "../../lib/dates";
import { appError, type AppErrorData } from "../lib/errors";
import { displayAvailable, freeRoomsOfType } from "../lib/availability";
import { addBookingEvent, canGuestCancel, guestCancelDeadline, releaseNights } from "../lib/bookings";
import { resolveImage } from "../lib/images";
import { groupNightly } from "../lib/pricing";
import { rateLimiter } from "../lib/rateLimits";
import { newManageToken, safeEqual, sha256Hex } from "../lib/refs";
import { bestPrice, getSettings, offersForStay, overridesForStay, publishedRoomTypeBySlug } from "../lib/stays";
import { verifyTurnstile } from "../lib/turnstile";
import {
  guestArgs,
  normaliseEmail,
  normalisePhone,
  stayArgs,
  validateGuest,
  validateGuests,
  validateStay,
} from "../lib/validators";
import { bookingPurpose } from "../schema";

// Public booking API (docs/04, docs/05). Queries return `{ ok: false, error }`
// for bad input instead of throwing, so live UI (useQuery) can show the message.

type Failure = { ok: false; error: AppErrorData };
const fail = (e: unknown): Failure => {
  if (e instanceof ConvexError) return { ok: false, error: e.data as AppErrorData };
  throw e;
};

/** Every published room type for a stay, with live availability and the stay price. */
export const search = query({
  args: stayArgs,
  handler: async (ctx, args) => {
    const settings = await getSettings(ctx);
    let nights: number;
    try {
      nights = validateStay(args, settings, todayLagos());
    } catch (e) {
      return fail(e);
    }
    const roomTypes = (await ctx.db.query("roomTypes").withIndex("by_sort").collect()).filter((r) => r.published);
    const offers = await offersForStay(ctx, args.checkIn, args.checkOut);

    const results = await Promise.all(
      roomTypes.map(async (rt) => {
        const free = await freeRoomsOfType(ctx, rt._id, args.checkIn, args.checkOut);
        const overrides = await overridesForStay(ctx, rt._id, args.checkIn, args.checkOut);
        const price = bestPrice(rt, overrides, offers, args.checkIn, args.checkOut);
        const fitsParty = args.adults <= rt.maxAdults && args.children <= rt.maxChildren;
        return {
          slug: rt.slug,
          name: rt.name,
          category: rt.category,
          shortDescription: rt.shortDescription,
          facts: rt.facts,
          maxAdults: rt.maxAdults,
          maxChildren: rt.maxChildren,
          cover: await resolveImage(ctx, rt.images[0]),
          fitsParty,
          available: fitsParty ? displayAvailable(free.length) : 0,
          total: price.total,
          nightly: price.nightly,
          groups: groupNightly(price.nightly),
          offer: price.offer ? { slug: price.offer.slug, title: price.offer.title } : null,
        };
      }),
    );
    // Bookable first (in the hotel's order), sold-out and too-small types last.
    results.sort((a, b) => Number(b.available > 0) - Number(a.available > 0));
    return { ok: true as const, nights, results };
  },
});

/** Live price and availability for one room type (the room page booking card). */
export const quote = query({
  args: { roomTypeSlug: v.string(), ...stayArgs },
  handler: async (ctx, args) => {
    const settings = await getSettings(ctx);
    let roomType: Doc<"roomTypes">;
    let nights: number;
    try {
      roomType = await publishedRoomTypeBySlug(ctx, args.roomTypeSlug);
      nights = validateStay(args, settings, todayLagos());
      validateGuests(args, roomType);
    } catch (e) {
      return fail(e);
    }
    const free = await freeRoomsOfType(ctx, roomType._id, args.checkIn, args.checkOut);
    const overrides = await overridesForStay(ctx, roomType._id, args.checkIn, args.checkOut);
    const offers = await offersForStay(ctx, args.checkIn, args.checkOut);
    const price = bestPrice(roomType, overrides, offers, args.checkIn, args.checkOut);
    return {
      ok: true as const,
      nights,
      available: displayAvailable(free.length),
      total: price.total,
      nightly: price.nightly,
      groups: groupNightly(price.nightly),
      offer: price.offer ? { slug: price.offer.slug, title: price.offer.title } : null,
      taxNote: settings.taxNote ?? null,
    };
  },
});

/**
 * Reserve a room (pay at the hotel). Checks bot protection and rate limits,
 * then hands over to the single booking transaction.
 */
export const reserve = action({
  args: {
    roomTypeSlug: v.string(),
    ...stayArgs,
    guest: guestArgs,
    arrivalWindow: v.optional(v.string()),
    purpose: v.optional(bookingPurpose),
    specialRequests: v.optional(v.string()),
    acceptedTerms: v.boolean(),
    turnstileToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ref: string; token: string }> => {
    if (!args.acceptedTerms) {
      throw appError("INVALID_INPUT", "Please agree to the booking terms.", "acceptedTerms");
    }
    const guest = validateGuest(args.guest); // fail fast with field errors before spending limits
    const { ip } = await ctx.meta.getRequestMetadata();

    if (!(await verifyTurnstile(args.turnstileToken, ip))) {
      throw appError("FORBIDDEN", "We couldn't verify this request. Please refresh the page and try again.");
    }

    const limits = [
      rateLimiter.limit(ctx, "reserveGlobal"),
      rateLimiter.limit(ctx, "reserveByEmail", { key: normaliseEmail(guest.email) }),
      rateLimiter.limit(ctx, "reserveByPhone", { key: normalisePhone(guest.phone) ?? guest.phone }),
      ...(ip ? [rateLimiter.limit(ctx, "reserveByIp", { key: ip })] : []),
    ];
    const results = await Promise.all(limits);
    if (results.some((r) => !r.ok)) {
      throw appError("RATE_LIMITED", "Too many booking attempts. Please call or WhatsApp us and we'll book for you.");
    }

    const token = newManageToken();
    const { ref } = await ctx.runMutation(internal.booking.create, {
      roomTypeSlug: args.roomTypeSlug,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      adults: args.adults,
      children: args.children,
      guest,
      arrivalWindow: args.arrivalWindow,
      purpose: args.purpose,
      specialRequests: args.specialRequests,
      manageToken: token,
    });
    return { ref, token };
  },
});

async function bookingForToken(
  ctx: Parameters<typeof getSettings>[0],
  ref: string,
  token: string,
): Promise<Doc<"bookings"> | null> {
  const booking = await ctx.db
    .query("bookings")
    .withIndex("by_ref", (q) => q.eq("ref", ref.trim().toUpperCase()))
    .unique();
  // Hash even when the booking is missing, so timing doesn't reveal which refs exist.
  const hash = await sha256Hex(token);
  if (!booking || !safeEqual(hash, booking.manageTokenHash)) return null;
  return booking;
}

/** The guest's own booking page. Returns null for a wrong ref or token (never says which). */
export const forGuest = query({
  args: { ref: v.string(), token: v.string() },
  handler: async (ctx, { ref, token }) => {
    const booking = await bookingForToken(ctx, ref, token);
    if (!booking) return null;
    const settings = await getSettings(ctx);
    const roomType = await ctx.db.get(booking.roomTypeId);
    return {
      ref: booking.ref,
      status: booking.status,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      adults: booking.adults,
      children: booking.children,
      guest: { firstName: booking.guest.firstName, lastName: booking.guest.lastName, email: booking.guest.email },
      room: roomType
        ? { name: roomType.name, slug: roomType.slug, cover: await resolveImage(ctx, roomType.images[0]) }
        : null,
      groups: groupNightly(booking.nightly),
      amountDue: booking.amountDue,
      amountPaid: booking.amountPaid,
      balance: Math.max(0, booking.amountDue - booking.amountPaid),
      canCancel: canGuestCancel(booking, settings, Date.now()),
      cancelDeadline: guestCancelDeadline(booking.checkIn, settings),
      checkInTime: settings.checkInTime ?? null,
      checkOutTime: settings.checkOutTime ?? null,
      cancellationPolicy: settings.cancellationPolicy ?? null,
    };
  },
});

/** Guest cancels their own booking from the manage link, while the policy allows it. */
export const cancelByGuest = mutation({
  args: { ref: v.string(), token: v.string() },
  handler: async (ctx, { ref, token }) => {
    const limit = await rateLimiter.limit(ctx, "guestCancelByRef", { key: ref.trim().toUpperCase() });
    if (!limit.ok) throw appError("RATE_LIMITED", "Too many attempts. Please call or WhatsApp us.");

    const booking = await bookingForToken(ctx, ref, token);
    if (!booking) throw appError("NOT_FOUND", "We couldn't find that booking.");
    const settings = await getSettings(ctx);
    if (!canGuestCancel(booking, settings, Date.now())) {
      throw appError(
        "CONFLICT",
        booking.status === "cancelled"
          ? "This booking is already cancelled."
          : "This booking can no longer be cancelled online. Please call or WhatsApp us.",
      );
    }

    await releaseNights(ctx, booking._id);
    await ctx.db.patch(booking._id, {
      status: "cancelled",
      cancelledReason: "Cancelled by the guest online",
      updatedAt: Date.now(),
    });
    await addBookingEvent(ctx, booking._id, "cancelled", "Cancelled by the guest from the manage-booking link.");
    await ctx.scheduler.runAfter(0, internal.emails.bookingCancelled, { bookingId: booking._id, by: "guest" });
    return { ok: true as const };
  },
});
