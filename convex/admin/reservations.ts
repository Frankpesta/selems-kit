import { v } from "convex/values";
import { action, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { addDays, nightsBetween, nowLagosHHmm, todayLagos } from "../../lib/dates";
import { formatDateShort, plural } from "../../lib/format";
import { requireStaff } from "../lib/auth";
import { audit } from "../lib/audit";
import { addBookingEvent, occupyNights, paymentStatusFor, releaseNights } from "../lib/bookings";
import { appError } from "../lib/errors";
import { newManageToken, nextRef, sha256Hex } from "../lib/refs";
import {
  assertKoboAmount,
  assertRoomFree,
  balanceOf,
  isManuallyPriced,
  loadBooking,
  manualNightly,
  naira,
  standardPrice,
  validatePartySize,
  validateStaffGuest,
  validateStaffStay,
} from "../lib/staffBookings";
import { freeRoomsOfType } from "../lib/availability";
import { getSettings } from "../lib/stays";
import { bookingSearchText, normalisePhone, validateSpecialRequests } from "../lib/validators";
import { bookingPurpose, bookingSource } from "../schema";

// Reservations for the front desk (docs/06). Every function checks the caller is
// active staff; every write records a booking event and an audit entry.

const LIST_LIMIT = 200;

export const tab = v.union(
  v.literal("all"),
  v.literal("attention"),
  v.literal("arriving"),
  v.literal("in_house"),
  v.literal("checked_out"),
  v.literal("cancelled"),
);

type Maps = { types: Map<Id<"roomTypes">, Doc<"roomTypes">>; rooms: Map<Id<"rooms">, Doc<"rooms">> };

export async function loadMaps(ctx: QueryCtx): Promise<Maps> {
  const [types, rooms] = await Promise.all([ctx.db.query("roomTypes").collect(), ctx.db.query("rooms").collect()]);
  return { types: new Map(types.map((t) => [t._id, t])), rooms: new Map(rooms.map((r) => [r._id, r])) };
}

/** Why a booking needs a person to look at it, or null. */
export function attentionReason(b: Doc<"bookings">, today: string, cutoff: string, nowHHmm: string): string | null {
  if (b.status === "reserved" && b.checkIn < today) return "Arrival date passed: check in or mark a no-show";
  if (b.status === "reserved" && (b.lateArrivalFlag || (b.checkIn === today && nowHHmm >= cutoff))) {
    return `Late: not arrived by ${cutoff}`;
  }
  if (b.status === "checked_in" && b.checkOut < today) return "Past check-out date: check out or extend";
  if (b.status === "reserved" && b.source === "website" && b.viewedAt === undefined) return "New website booking";
  return null;
}

export function bookingRow(b: Doc<"bookings">, maps: Maps, attention: string | null = null) {
  const type = maps.types.get(b.roomTypeId);
  const room = maps.rooms.get(b.roomId);
  return {
    id: b._id,
    ref: b.ref,
    guest: `${b.guest.firstName} ${b.guest.lastName}`,
    phone: b.guest.phone,
    roomType: type?.name ?? "Room",
    roomNumber: room?.number ?? "–",
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    adults: b.adults,
    children: b.children,
    source: b.source,
    status: b.status,
    paymentStatus: b.paymentStatus,
    amountDue: b.amountDue,
    amountPaid: b.amountPaid,
    balance: balanceOf(b),
    arrivalWindow: b.arrivalWindow ?? null,
    lateArrivalFlag: !!b.lateArrivalFlag,
    viewed: b.viewedAt !== undefined,
    createdAt: b.createdAt,
    attention,
  };
}
export type BookingRow = ReturnType<typeof bookingRow>;

const listArgs = {
  tab,
  search: v.optional(v.string()),
  from: v.optional(v.string()), // check-in on or after
  to: v.optional(v.string()), // check-in on or before
  roomTypeId: v.optional(v.id("roomTypes")),
  source: v.optional(bookingSource),
};

async function findBookings(
  ctx: QueryCtx,
  args: { tab: Doc<"bookings">["status"] | string; search?: string; from?: string; to?: string },
  today: string,
): Promise<Doc<"bookings">[]> {
  const q = args.search?.trim();
  if (q) {
    const phone = /^[+\d\s()-]{7,}$/.test(q) ? normalisePhone(q) : null;
    const term = (phone ?? q).toLowerCase();
    return ctx.db
      .query("bookings")
      .withSearchIndex("search_guest", (s) => s.search("searchText", term))
      .take(50);
  }
  const byStatus = (status: Doc<"bookings">["status"]) =>
    ctx.db.query("bookings").withIndex("by_status_checkIn", (i) => i.eq("status", status));
  switch (args.tab) {
    case "attention":
      return [...(await byStatus("reserved").collect()), ...(await byStatus("checked_in").collect())];
    case "arriving":
      return ctx.db
        .query("bookings")
        .withIndex("by_status_checkIn", (i) => i.eq("status", "reserved").gte("checkIn", today).lte("checkIn", addDays(today, 7)))
        .collect();
    case "in_house":
      return byStatus("checked_in").collect();
    case "checked_out":
      return ctx.db
        .query("bookings")
        .withIndex("by_status_checkOut", (i) => i.eq("status", "checked_out"))
        .order("desc")
        .take(LIST_LIMIT);
    case "cancelled":
      return [
        ...(await byStatus("cancelled").order("desc").take(LIST_LIMIT)),
        ...(await byStatus("no_show").order("desc").take(LIST_LIMIT)),
      ];
    default: {
      const from = args.from;
      const to = args.to;
      if (from || to) {
        return ctx.db
          .query("bookings")
          .withIndex("by_checkIn", (i) => {
            const lower = from ? i.gte("checkIn", from) : i.gte("checkIn", "");
            return to ? lower.lte("checkIn", to) : lower;
          })
          .take(LIST_LIMIT * 2);
      }
      return ctx.db.query("bookings").withIndex("by_checkIn").order("desc").take(LIST_LIMIT);
    }
  }
}

async function filteredRows(
  ctx: QueryCtx,
  args: { tab: string; search?: string; from?: string; to?: string; roomTypeId?: Id<"roomTypes">; source?: Doc<"bookings">["source"] },
) {
  const settings = await getSettings(ctx);
  const today = todayLagos();
  const now = nowLagosHHmm();
  const maps = await loadMaps(ctx);
  const found = await findBookings(ctx, args, today);
  const rows = found
    .filter((b) => (args.from ? b.checkIn >= args.from : true) && (args.to ? b.checkIn <= args.to : true))
    .filter((b) => (args.roomTypeId ? b.roomTypeId === args.roomTypeId : true))
    .filter((b) => (args.source ? b.source === args.source : true))
    .map((b) => ({ b, attention: attentionReason(b, today, settings.noShowCutoff, now) }))
    .filter(({ attention }) => (args.tab === "attention" && !args.search ? attention !== null : true))
    .map(({ b, attention }) => bookingRow(b, maps, attention));
  // Upcoming tabs read soonest first; history tabs most recent first.
  const ascending = args.tab === "arriving" || args.tab === "in_house" || args.tab === "attention";
  rows.sort((a, b) => (ascending ? a.checkIn.localeCompare(b.checkIn) : b.checkIn.localeCompare(a.checkIn)));
  return rows.slice(0, LIST_LIMIT);
}

export const list = query({
  args: listArgs,
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    return filteredRows(ctx, args);
  },
});

/** The same rows as the list, with the extra columns accounting needs (CSV export). */
export const exportRows = query({
  args: listArgs,
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const rows = await filteredRows(ctx, args);
    const full = await Promise.all(rows.map((r) => ctx.db.get(r.id)));
    return rows.map((r, i) => ({ ...r, email: full[i]?.guest.email ?? "" }));
  },
});

/** Ctrl+K search: guest name, phone or ref. */
export const quickSearch = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    await requireStaff(ctx);
    if (q.trim().length < 2) return [];
    const maps = await loadMaps(ctx);
    const found = await findBookings(ctx, { tab: "all", search: q }, todayLagos());
    return found.slice(0, 8).map((b) => bookingRow(b, maps));
  },
});

/** One booking with payments, history and what can be done to it. */
export const get = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b) return null;
    const settings = await getSettings(ctx);
    const maps = await loadMaps(ctx);
    const today = todayLagos();
    const staff = new Map((await ctx.db.query("staffProfiles").collect()).map((s) => [s.userId, s.name]));
    const payments = await ctx.db.query("payments").withIndex("by_booking", (q) => q.eq("bookingId", id)).collect();
    const events = await ctx.db.query("bookingEvents").withIndex("by_booking", (q) => q.eq("bookingId", id)).collect();
    const offer = b.offerId ? await ctx.db.get(b.offerId) : null;
    const creator = b.createdBy ? staff.get(b.createdBy) : null;
    return {
      ...bookingRow(b, maps, attentionReason(b, today, settings.noShowCutoff, nowLagosHHmm())),
      roomTypeId: b.roomTypeId,
      roomId: b.roomId,
      guestDetails: b.guest,
      purpose: b.purpose ?? null,
      specialRequests: b.specialRequests ?? null,
      cancelledReason: b.cancelledReason ?? null,
      nightly: b.nightly,
      manualRate: isManuallyPriced(b),
      offerTitle: offer?.title ?? null,
      createdBy: creator ?? (b.source === "website" ? "Website" : null),
      payments: payments
        .sort((a, c) => c.at - a.at)
        .map((p) => ({ id: p._id, amount: p.amount, method: p.method, note: p.note ?? null, at: p.at, by: staff.get(p.receivedBy) ?? "Staff" })),
      events: events
        .sort((a, c) => c.at - a.at)
        .map((e) => ({ id: e._id, type: e.type, message: e.message, at: e.at, by: e.by ? (staff.get(e.by) ?? "Staff") : null })),
      today,
      canCheckIn: b.status === "reserved" && b.checkIn <= today,
      canCheckOut: b.status === "checked_in",
      canCancel: b.status === "reserved",
      canNoShow: b.status === "reserved" && b.checkIn <= today,
      canChange: b.status === "reserved" || b.status === "checked_in",
    };
  },
});

/** Opening a website booking marks it seen (Today → "not yet viewed"). */
export const markViewed = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    const me = await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b || b.viewedAt !== undefined) return;
    await ctx.db.patch(id, { viewedAt: Date.now() });
    if (b.source === "website") await addBookingEvent(ctx, id, "viewed", `Viewed by ${me.name}.`, me.userId);
  },
});

// ─── New booking (phone, WhatsApp, walk-in) ──────────────────────────────────

/** Room types with free rooms and the standard price for a stay (new-booking dialog). */
export const availableForStay = query({
  args: { checkIn: v.string(), checkOut: v.string(), ignoreBookingId: v.optional(v.id("bookings")) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    try {
      validateStaffStay(args, todayLagos(), { allowPastCheckIn: !!args.ignoreBookingId });
    } catch (e) {
      const data = (e as { data?: { message?: string } }).data;
      return { ok: false as const, message: data?.message ?? "Choose valid dates." };
    }
    const types = await ctx.db.query("roomTypes").withIndex("by_sort").collect();
    const results = await Promise.all(
      types.map(async (t) => {
        const free = await freeRoomsOfType(ctx, t._id, args.checkIn, args.checkOut, args.ignoreBookingId);
        const price = await standardPrice(ctx, t, args.checkIn, args.checkOut);
        return {
          roomTypeId: t._id,
          name: t.name,
          published: t.published,
          maxAdults: t.maxAdults,
          maxChildren: t.maxChildren,
          freeRooms: free.map((r) => ({ id: r._id, number: r.number })),
          total: price.total,
          nightly: price.nightly,
          offerTitle: price.offer?.title ?? null,
        };
      }),
    );
    return { ok: true as const, nights: nightsBetween(args.checkIn, args.checkOut), results };
  },
});

const staffGuestArgs = v.object({
  firstName: v.string(),
  lastName: v.string(),
  email: v.optional(v.string()),
  phone: v.string(),
});

const createArgs = {
  roomTypeId: v.id("roomTypes"),
  roomId: v.optional(v.id("rooms")),
  checkIn: v.string(),
  checkOut: v.string(),
  adults: v.number(),
  children: v.number(),
  guest: staffGuestArgs,
  source: bookingSource,
  arrivalWindow: v.optional(v.string()),
  purpose: v.optional(bookingPurpose),
  specialRequests: v.optional(v.string()),
  rateOverride: v.optional(v.object({ nightlyRate: v.number(), reason: v.string() })),
  checkInNow: v.optional(v.boolean()),
  sendConfirmation: v.optional(v.boolean()),
};

/**
 * Staff booking. An action only so the guest's manage-link token comes from real
 * randomness; the booking itself is written in one mutation (createInternal),
 * which re-checks the room is free, exactly like a website booking.
 */
export const create = action({
  args: createArgs,
  handler: async (ctx, args): Promise<{ id: Id<"bookings">; ref: string }> => {
    const token = newManageToken();
    return ctx.runMutation(internal.admin.reservations.createInternal, { ...args, manageToken: token });
  },
});

export const createInternal = internalMutation({
  args: { ...createArgs, manageToken: v.string() },
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    if (args.source === "website") throw appError("INVALID_INPUT", "Choose how the guest booked.", "source");
    const today = todayLagos();
    const nights = validateStaffStay(args, today);
    validatePartySize(args);
    const guest = validateStaffGuest(args.guest);
    const specialRequests = validateSpecialRequests(args.specialRequests);
    const roomType = await ctx.db.get(args.roomTypeId);
    if (!roomType) throw appError("NOT_FOUND", "That room type doesn't exist.", "roomTypeId");

    // Room: the one staff chose (re-checked here), else the first free one.
    let room: Doc<"rooms">;
    if (args.roomId) {
      const chosen = await ctx.db.get(args.roomId);
      if (!chosen || chosen.roomTypeId !== roomType._id) throw appError("INVALID_INPUT", "Choose a room of this type.", "roomId");
      await assertRoomFree(ctx, chosen, args.checkIn, args.checkOut);
      room = chosen;
    } else {
      const free = await freeRoomsOfType(ctx, roomType._id, args.checkIn, args.checkOut);
      if (free.length === 0) throw appError("SOLD_OUT", `No ${roomType.name} is free for these dates.`);
      room = free[0];
    }

    let nightly: Doc<"bookings">["nightly"];
    let offerId: Id<"offers"> | undefined;
    let priceNote = "";
    if (args.rateOverride) {
      assertKoboAmount(args.rateOverride.nightlyRate, "nightlyRate", "nightly rate");
      const reason = args.rateOverride.reason.trim();
      if (!reason) throw appError("INVALID_INPUT", "Give a reason for the special rate.", "rateReason");
      nightly = manualNightly(args.checkIn, args.checkOut, args.rateOverride.nightlyRate);
      priceNote = ` Special rate ${naira(args.rateOverride.nightlyRate)} a night: ${reason.slice(0, 200)}.`;
    } else {
      const price = await standardPrice(ctx, roomType, args.checkIn, args.checkOut);
      nightly = price.nightly;
      offerId = price.offer?._id;
    }
    const total = nightly.reduce((s, n) => s + n.rate, 0);
    const checkInNow = !!args.checkInNow && args.checkIn <= today;

    const ref = await nextRef(ctx, today);
    const now = Date.now();
    const id = await ctx.db.insert("bookings", {
      ref,
      roomTypeId: roomType._id,
      roomId: room._id,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      nights,
      adults: args.adults,
      children: args.children,
      guest,
      arrivalWindow: args.arrivalWindow?.trim().slice(0, 40) || undefined,
      purpose: args.purpose,
      specialRequests,
      source: args.source,
      status: checkInNow ? "checked_in" : "reserved",
      nightly,
      offerId,
      amountDue: total,
      amountPaid: 0,
      paymentStatus: "unpaid",
      manageTokenHash: await sha256Hex(args.manageToken),
      createdBy: me.userId,
      viewedAt: now,
      searchText: bookingSearchText({ ref, guest }),
      createdAt: now,
      updatedAt: now,
    });
    await occupyNights(ctx, id, room._id, args.checkIn, args.checkOut);
    await addBookingEvent(
      ctx,
      id,
      "created",
      `Booked by ${me.name} (${SOURCE_LABEL[args.source]}): ${roomType.name}, room ${room.number}, ${plural(nights, "night")}.${priceNote}`,
      me.userId,
    );
    if (checkInNow) await addBookingEvent(ctx, id, "checked_in", `Checked in by ${me.name}.`, me.userId);
    await audit(ctx, me, "booking.create", "bookings", id, `${ref} for ${guest.firstName} ${guest.lastName}`);
    if (guest.email && args.sendConfirmation !== false) {
      await ctx.scheduler.runAfter(0, internal.emails.bookingConfirmation, { bookingId: id, token: args.manageToken });
    }
    return { id, ref };
  },
});

export const SOURCE_LABEL: Record<Doc<"bookings">["source"], string> = {
  website: "website",
  phone: "phone",
  whatsapp: "WhatsApp",
  walk_in: "walk-in",
  email: "email",
  other: "other",
};

/** Sends the confirmation again with a fresh manage link (the old link stops working). */
export const resendConfirmation = action({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }): Promise<{ email: string }> => {
    const token = newManageToken();
    return ctx.runMutation(internal.admin.reservations.resendInternal, { id, manageToken: token });
  },
});

export const resendInternal = internalMutation({
  args: { id: v.id("bookings"), manageToken: v.string() },
  handler: async (ctx, { id, manageToken }) => {
    const me = await requireStaff(ctx);
    const b = await loadBooking(ctx, id);
    if (!b.guest.email) throw appError("INVALID_INPUT", "Add the guest's email address first.", "email");
    if (b.status === "cancelled" || b.status === "no_show") throw appError("CONFLICT", "This booking is no longer active.");
    await ctx.db.patch(id, { manageTokenHash: await sha256Hex(manageToken), updatedAt: Date.now() });
    await addBookingEvent(ctx, id, "email_resent", `Confirmation re-sent by ${me.name} with a new manage link.`, me.userId);
    await audit(ctx, me, "booking.resend", "bookings", id, `${b.ref} confirmation re-sent`);
    await ctx.scheduler.runAfter(0, internal.emails.bookingConfirmation, { bookingId: id, token: manageToken });
    return { email: b.guest.email };
  },
});

// ─── Changes ─────────────────────────────────────────────────────────────────

async function writable(ctx: MutationCtx, id: Id<"bookings">) {
  const me = await requireStaff(ctx);
  const b = await loadBooking(ctx, id);
  return { me, b };
}

function assertActive(b: Doc<"bookings">) {
  if (b.status !== "reserved" && b.status !== "checked_in") {
    throw appError("CONFLICT", `${b.ref} is ${STATUS_LABEL[b.status].toLowerCase()} and can't be changed.`);
  }
}

export const STATUS_LABEL: Record<Doc<"bookings">["status"], string> = {
  reserved: "Reserved",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/**
 * New dates (and optionally a different room) in one transaction: the booking's
 * own nights are released, the room is re-checked for the new nights, then taken.
 */
export const changeDates = mutation({
  args: {
    id: v.id("bookings"),
    checkIn: v.string(),
    checkOut: v.string(),
    roomId: v.optional(v.id("rooms")),
    reprice: v.optional(v.boolean()),
    notifyGuest: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { me, b } = await writable(ctx, args.id);
    assertActive(b);
    if (b.status === "checked_in" && args.checkIn !== b.checkIn) {
      throw appError("INVALID_DATES", "The guest has checked in, so only the check-out date can change.", "checkIn");
    }
    const today = todayLagos();
    const nights = validateStaffStay(args, today, { allowPastCheckIn: b.status === "checked_in" || args.checkIn === b.checkIn });
    if (b.status === "checked_in" && args.checkOut < today) {
      throw appError("INVALID_DATES", "Check-out can't be in the past.", "checkOut");
    }
    const room = await ctx.db.get(args.roomId ?? b.roomId);
    if (!room) throw appError("NOT_FOUND", "That room doesn't exist.", "roomId");
    await assertRoomFree(ctx, room, args.checkIn, args.checkOut, b._id);

    const roomType = await ctx.db.get(room.roomTypeId);
    if (!roomType) throw appError("NOT_FOUND", "That room type doesn't exist.");
    const datesChanged = args.checkIn !== b.checkIn || args.checkOut !== b.checkOut;
    let nightly = b.nightly;
    let offerId = b.offerId;
    if (datesChanged || args.reprice) {
      if (isManuallyPriced(b) && !args.reprice) {
        nightly = manualNightly(args.checkIn, args.checkOut, b.nightly[0].rate);
      } else {
        const price = await standardPrice(ctx, roomType, args.checkIn, args.checkOut);
        nightly = price.nightly;
        offerId = price.offer?._id;
      }
    }
    const amountDue = nightly.reduce((s, n) => s + n.rate, 0);

    await releaseNights(ctx, b._id);
    await occupyNights(ctx, b._id, room._id, args.checkIn, args.checkOut);
    await ctx.db.patch(b._id, {
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      nights,
      roomId: room._id,
      roomTypeId: room.roomTypeId,
      nightly,
      offerId,
      amountDue,
      paymentStatus: paymentStatusFor(amountDue, b.amountPaid),
      lateArrivalFlag: args.checkIn !== b.checkIn ? undefined : b.lateArrivalFlag,
      updatedAt: Date.now(),
    });
    const parts = [
      datesChanged ? `dates ${formatDateShort(b.checkIn)}–${formatDateShort(b.checkOut)} → ${formatDateShort(args.checkIn)}–${formatDateShort(args.checkOut)}` : null,
      room._id !== b.roomId ? `room → ${room.number}` : null,
      amountDue !== b.amountDue ? `total ${naira(b.amountDue)} → ${naira(amountDue)}` : null,
    ].filter(Boolean);
    const message = `Changed by ${me.name}: ${parts.join(", ") || "re-priced, no change"}.`;
    await addBookingEvent(ctx, b._id, "changed", message, me.userId);
    await audit(ctx, me, "booking.changeDates", "bookings", b._id, `${b.ref}: ${parts.join(", ")}`);
    if (b.guest.email && args.notifyGuest !== false && (datesChanged || room.roomTypeId !== b.roomTypeId)) {
      await ctx.scheduler.runAfter(0, internal.emails.bookingChanged, { bookingId: b._id });
    }
    return { amountDue, roomNumber: room.number };
  },
});

/** Same nights, another room (drag on the availability grid, or "Move room"). */
export const moveRoom = mutation({
  args: { id: v.id("bookings"), roomId: v.id("rooms"), notifyGuest: v.optional(v.boolean()) },
  handler: async (ctx, { id, roomId, notifyGuest }) => {
    const { me, b } = await writable(ctx, id);
    assertActive(b);
    if (roomId === b.roomId) return { roomNumber: (await ctx.db.get(roomId))?.number ?? "" };
    const room = await ctx.db.get(roomId);
    if (!room) throw appError("NOT_FOUND", "That room doesn't exist.", "roomId");
    const today = todayLagos();
    // A checked-in guest moves from tonight on; earlier nights stay where they slept.
    const from = b.status === "checked_in" && b.checkIn < today ? today : b.checkIn;
    if (from >= b.checkOut) throw appError("CONFLICT", "This stay has no nights left to move.");
    await assertRoomFree(ctx, room, from, b.checkOut, b._id);

    const oldRoom = await ctx.db.get(b.roomId);
    await releaseNights(ctx, b._id, from);
    await occupyNights(ctx, b._id, room._id, from, b.checkOut);
    await ctx.db.patch(b._id, { roomId: room._id, roomTypeId: room.roomTypeId, updatedAt: Date.now() });
    const typeChanged = room.roomTypeId !== b.roomTypeId;
    const newType = typeChanged ? await ctx.db.get(room.roomTypeId) : null;
    const message = `Moved by ${me.name} from room ${oldRoom?.number ?? "?"} to ${room.number}${newType ? ` (${newType.name}, price unchanged)` : ""}.`;
    await addBookingEvent(ctx, b._id, "moved", message, me.userId);
    await audit(ctx, me, "booking.moveRoom", "bookings", b._id, `${b.ref} → room ${room.number}`);
    if (typeChanged && b.guest.email && notifyGuest !== false) {
      await ctx.scheduler.runAfter(0, internal.emails.bookingChanged, { bookingId: b._id });
    }
    return { roomNumber: room.number };
  },
});

export const updateGuest = mutation({
  args: {
    id: v.id("bookings"),
    guest: staffGuestArgs,
    adults: v.number(),
    children: v.number(),
    arrivalWindow: v.optional(v.string()),
    purpose: v.optional(bookingPurpose),
    specialRequests: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me, b } = await writable(ctx, args.id);
    const guest = validateStaffGuest(args.guest);
    if (b.source === "website" && !guest.email) {
      throw appError("INVALID_INPUT", "Website bookings need the guest's email address.", "email");
    }
    validatePartySize(args);
    await ctx.db.patch(b._id, {
      guest,
      adults: args.adults,
      children: args.children,
      arrivalWindow: args.arrivalWindow?.trim().slice(0, 40) || undefined,
      purpose: args.purpose,
      specialRequests: validateSpecialRequests(args.specialRequests),
      searchText: bookingSearchText({ ref: b.ref, guest }),
      updatedAt: Date.now(),
    });
    await addBookingEvent(ctx, b._id, "guest_updated", `Guest details updated by ${me.name}.`, me.userId);
    await audit(ctx, me, "booking.updateGuest", "bookings", b._id, `${b.ref} guest details`);
  },
});

export const checkIn = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    const { me, b } = await writable(ctx, id);
    if (b.status !== "reserved") throw appError("CONFLICT", `${b.ref} is ${STATUS_LABEL[b.status].toLowerCase()}.`);
    const today = todayLagos();
    if (b.checkIn > today) {
      throw appError("CONFLICT", `This booking starts on ${formatDateShort(b.checkIn)}. Change the dates to check in early.`);
    }
    await ctx.db.patch(id, { status: "checked_in", lateArrivalFlag: undefined, viewedAt: b.viewedAt ?? Date.now(), updatedAt: Date.now() });
    await addBookingEvent(ctx, id, "checked_in", `Checked in by ${me.name}.`, me.userId);
    await audit(ctx, me, "booking.checkIn", "bookings", id, b.ref);
  },
});

/**
 * Check out. With a balance still due, staff must give a reason to go ahead.
 * Leaving before the booked check-out date frees the remaining nights.
 */
export const checkOut = mutation({
  args: { id: v.id("bookings"), overrideReason: v.optional(v.string()) },
  handler: async (ctx, { id, overrideReason }) => {
    const { me, b } = await writable(ctx, id);
    if (b.status !== "checked_in") throw appError("CONFLICT", `${b.ref} isn't checked in.`);
    const balance = balanceOf(b);
    const reason = overrideReason?.trim();
    if (balance > 0 && !reason) {
      throw appError("CONFLICT", `${naira(balance)} is still due. Record the payment, or give a reason to check out anyway.`, "overrideReason");
    }
    const today = todayLagos();
    let early = "";
    if (today < b.checkOut) {
      await releaseNights(ctx, id, today);
      early = ` Left early: nights from ${formatDateShort(today)} released.`;
    }
    await ctx.db.patch(id, { status: "checked_out", updatedAt: Date.now() });
    const owed = balance > 0 ? ` ${naira(balance)} unpaid: ${reason!.slice(0, 200)}.` : "";
    await addBookingEvent(ctx, id, "checked_out", `Checked out by ${me.name}.${early}${owed}`, me.userId);
    await audit(ctx, me, "booking.checkOut", "bookings", id, `${b.ref}${owed}`);
  },
});

export const cancel = mutation({
  args: { id: v.id("bookings"), reason: v.string(), notifyGuest: v.optional(v.boolean()) },
  handler: async (ctx, { id, reason, notifyGuest }) => {
    const { me, b } = await writable(ctx, id);
    if (b.status !== "reserved") {
      throw appError("CONFLICT", b.status === "checked_in" ? "The guest has checked in. Check them out instead." : `${b.ref} is already ${STATUS_LABEL[b.status].toLowerCase()}.`);
    }
    const why = reason.trim();
    if (!why) throw appError("INVALID_INPUT", "Give a reason for cancelling.", "reason");
    await releaseNights(ctx, id);
    await ctx.db.patch(id, { status: "cancelled", cancelledReason: why.slice(0, 300), updatedAt: Date.now() });
    await addBookingEvent(ctx, id, "cancelled", `Cancelled by ${me.name}: ${why.slice(0, 300)}`, me.userId);
    await audit(ctx, me, "booking.cancel", "bookings", id, `${b.ref}: ${why.slice(0, 100)}`);
    if (b.guest.email && notifyGuest !== false) {
      await ctx.scheduler.runAfter(0, internal.emails.bookingCancelled, { bookingId: id, by: "staff" });
    }
  },
});

export const markNoShow = mutation({
  args: { id: v.id("bookings"), notifyGuest: v.optional(v.boolean()) },
  handler: async (ctx, { id, notifyGuest }) => {
    const { me, b } = await writable(ctx, id);
    if (b.status !== "reserved") throw appError("CONFLICT", `${b.ref} is ${STATUS_LABEL[b.status].toLowerCase()}.`);
    if (b.checkIn > todayLagos()) throw appError("CONFLICT", "The guest isn't due yet.");
    await releaseNights(ctx, id);
    await ctx.db.patch(id, { status: "no_show", lateArrivalFlag: undefined, updatedAt: Date.now() });
    await addBookingEvent(ctx, id, "no_show", `Marked as a no-show by ${me.name}. Room released.`, me.userId);
    await audit(ctx, me, "booking.noShow", "bookings", id, b.ref);
    if (b.guest.email && notifyGuest) {
      await ctx.scheduler.runAfter(0, internal.emails.bookingCancelled, { bookingId: id, by: "staff" });
    }
  },
});

export const recordPayment = mutation({
  args: {
    id: v.id("bookings"),
    amount: v.number(),
    method: v.union(v.literal("cash"), v.literal("transfer"), v.literal("pos"), v.literal("other")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me, b } = await writable(ctx, args.id);
    assertKoboAmount(args.amount, "amount");
    if (b.status === "cancelled") throw appError("CONFLICT", "This booking is cancelled.");
    const balance = balanceOf(b);
    if (args.amount > balance) {
      throw appError("INVALID_INPUT", balance === 0 ? "Nothing is due on this booking." : `That's more than the balance of ${naira(balance)}.`, "amount");
    }
    const note = args.note?.trim().slice(0, 200) || undefined;
    await ctx.db.insert("payments", { bookingId: b._id, amount: args.amount, method: args.method, note, receivedBy: me.userId, at: Date.now() });
    const amountPaid = b.amountPaid + args.amount;
    await ctx.db.patch(b._id, { amountPaid, paymentStatus: paymentStatusFor(b.amountDue, amountPaid), updatedAt: Date.now() });
    const label = { cash: "cash", transfer: "bank transfer", pos: "POS", other: "other" }[args.method];
    await addBookingEvent(ctx, b._id, "payment", `${naira(args.amount)} received by ${me.name} (${label})${note ? `: ${note}` : ""}.`, me.userId);
    await audit(ctx, me, "booking.payment", "bookings", b._id, `${b.ref}: ${naira(args.amount)} ${label}`);
    return { balance: Math.max(0, b.amountDue - amountPaid) };
  },
});

export const addNote = mutation({
  args: { id: v.id("bookings"), message: v.string() },
  handler: async (ctx, { id, message }) => {
    const { me, b } = await writable(ctx, id);
    const text = message.trim();
    if (!text) throw appError("INVALID_INPUT", "Write a note first.", "message");
    if (text.length > 1000) throw appError("INVALID_INPUT", "Keep notes under 1,000 characters.", "message");
    await addBookingEvent(ctx, b._id, "note", text, me.userId);
  },
});
