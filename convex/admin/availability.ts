import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { addDays, isDateString, isWeekendNight, nightsBetween, nowLagosHHmm, todayLagos } from "../../lib/dates";
import { formatDateShort, plural } from "../../lib/format";
import { requireStaff } from "../lib/auth";
import { audit } from "../lib/audit";
import { appError } from "../lib/errors";
import { assertRoomFree } from "../lib/staffBookings";
import { getSettings } from "../lib/stays";
import { attentionReason } from "./reservations";

// Availability grid (docs/06): rooms × nights with booking and block segments.

const MAX_DAYS = 31;

export const blockReason = v.union(v.literal("maintenance"), v.literal("event"), v.literal("owner_use"), v.literal("other"));

export type Segment =
  | {
      kind: "booking";
      id: Id<"bookings">;
      start: number; // column index of the first night shown
      span: number; // nights shown
      startsBefore: boolean;
      endsAfter: boolean;
      ref: string;
      guest: string;
      status: Doc<"bookings">["status"];
      paymentStatus: Doc<"bookings">["paymentStatus"];
      attention: boolean;
      checkIn: string;
      checkOut: string;
    }
  | {
      kind: "block";
      id: Id<"blocks">;
      start: number;
      span: number;
      startsBefore: boolean;
      endsAfter: boolean;
      reason: Doc<"blocks">["reason"];
      note: string | null;
      startDate: string;
      endDate: string;
    };

export const grid = query({
  args: { from: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    if (!isDateString(args.from)) throw appError("INVALID_DATES", "Choose a valid date.");
    const days = Math.min(Math.max(Math.round(args.days ?? 14), 1), MAX_DAYS);
    const dates = Array.from({ length: days }, (_, i) => addDays(args.from, i));
    const settings = await getSettings(ctx);
    const today = todayLagos();
    const now = nowLagosHHmm();

    const types = await ctx.db.query("roomTypes").withIndex("by_sort").collect();
    const rooms = await ctx.db.query("rooms").collect();
    const typeOrder = new Map(types.map((t, i) => [t._id, i]));
    rooms.sort(
      (a, b) =>
        (typeOrder.get(a.roomTypeId) ?? 99) - (typeOrder.get(b.roomTypeId) ?? 99) ||
        a.number.localeCompare(b.number, "en", { numeric: true }),
    );

    // Occupancy rows for the window, grouped by room.
    const byRoom = new Map<Id<"rooms">, { date: string; bookingId?: Id<"bookings">; blockId?: Id<"blocks"> }[]>();
    for (const date of dates) {
      const rows = await ctx.db.query("occupancy").withIndex("by_date", (q) => q.eq("date", date)).collect();
      for (const r of rows) {
        const list = byRoom.get(r.roomId) ?? [];
        list.push({ date, bookingId: r.bookingId, blockId: r.blockId });
        byRoom.set(r.roomId, list);
      }
    }
    const bookings = new Map<Id<"bookings">, Doc<"bookings"> | null>();
    const blocks = new Map<Id<"blocks">, Doc<"blocks"> | null>();
    const col = (d: string) => nightsBetween(args.from, d);

    const rows: {
      id: Id<"rooms">;
      number: string;
      roomTypeId: Id<"roomTypes">;
      typeName: string;
      category: "room" | "suite";
      status: Doc<"rooms">["status"];
      note: string | null;
      segments: Segment[];
      taken: boolean[];
    }[] = [];
    for (const room of rooms) {
      const occ = byRoom.get(room._id) ?? [];
      const segments: Segment[] = [];
      const seen = new Set<string>();
      for (const o of occ) {
        const key = o.bookingId ?? o.blockId!;
        if (seen.has(key)) continue;
        seen.add(key);
        if (o.bookingId) {
          if (!bookings.has(o.bookingId)) bookings.set(o.bookingId, await ctx.db.get(o.bookingId));
          const b = bookings.get(o.bookingId);
          if (!b) continue;
          // Nights of this booking in this room within the window (a mid-stay move splits a stay across rooms).
          const mine = occ.filter((x) => x.bookingId === b._id).map((x) => x.date).sort();
          const first = mine[0];
          const last = mine[mine.length - 1];
          segments.push({
            kind: "booking",
            id: b._id,
            start: col(first),
            span: col(last) - col(first) + 1,
            startsBefore: first > b.checkIn && first === args.from,
            endsAfter: addDays(last, 1) < b.checkOut && last === dates[dates.length - 1],
            ref: b.ref,
            guest: `${b.guest.firstName} ${b.guest.lastName}`,
            status: b.status,
            paymentStatus: b.paymentStatus,
            // Late or overdue (not merely "new website booking").
            attention: !(attentionReason(b, today, settings.noShowCutoff, now)?.startsWith("New") ?? true),
            checkIn: b.checkIn,
            checkOut: b.checkOut,
          });
        } else if (o.blockId) {
          if (!blocks.has(o.blockId)) blocks.set(o.blockId, await ctx.db.get(o.blockId));
          const bl = blocks.get(o.blockId);
          if (!bl) continue;
          const first = bl.startDate < args.from ? args.from : bl.startDate;
          const lastNight = addDays(bl.endDate, -1);
          const last = lastNight > dates[dates.length - 1] ? dates[dates.length - 1] : lastNight;
          segments.push({
            kind: "block",
            id: bl._id,
            start: col(first),
            span: col(last) - col(first) + 1,
            startsBefore: bl.startDate < args.from,
            endsAfter: lastNight > dates[dates.length - 1],
            reason: bl.reason,
            note: bl.note ?? null,
            startDate: bl.startDate,
            endDate: bl.endDate,
          });
        }
      }
      const type = types.find((t) => t._id === room.roomTypeId);
      rows.push({
        id: room._id,
        number: room.number,
        roomTypeId: room.roomTypeId,
        typeName: type?.name ?? "Room",
        category: type?.category ?? "room",
        status: room.status,
        note: room.notes ?? null,
        segments,
        taken: dates.map((d) => occ.some((o) => o.date === d)),
      });
    }

    // Footer: free rooms per night, suites and rooms.
    const free = dates.map((_, i) => {
      const count = (cat: "room" | "suite") =>
        rows.filter((r) => r.category === cat && r.status === "active" && !r.taken[i]).length;
      return { suites: count("suite"), rooms: count("room") };
    });

    return {
      from: args.from,
      today,
      dates: dates.map((d) => ({ date: d, weekend: isWeekendNight(d), today: d === today })),
      rows: rows.map(({ taken, ...r }) => (void taken, r)),
      free,
    };
  },
});

export const createBlock = mutation({
  args: {
    roomId: v.id("rooms"),
    startDate: v.string(),
    endDate: v.string(), // exclusive, like check-out
    reason: blockReason,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    if (!isDateString(args.startDate) || !isDateString(args.endDate) || args.endDate <= args.startDate) {
      throw appError("INVALID_DATES", "Choose a first night and an end date after it.");
    }
    if (args.startDate < todayLagos()) throw appError("INVALID_DATES", "A block can't start in the past.", "startDate");
    const nights = nightsBetween(args.startDate, args.endDate);
    if (nights > 366) throw appError("INVALID_DATES", "Block at most a year at a time.", "endDate");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw appError("NOT_FOUND", "That room doesn't exist.");
    await assertRoomFree(ctx, room, args.startDate, args.endDate);
    const note = args.note?.trim().slice(0, 200) || undefined;
    const blockId = await ctx.db.insert("blocks", { ...args, note, createdBy: me.userId });
    for (let d = args.startDate; d < args.endDate; d = addDays(d, 1)) {
      await ctx.db.insert("occupancy", { roomId: room._id, date: d, blockId });
    }
    await audit(
      ctx,
      me,
      "block.create",
      "blocks",
      blockId,
      `Room ${room.number} blocked ${formatDateShort(args.startDate)}, ${plural(nights, "night")} (${args.reason})`,
    );
    return blockId;
  },
});

export const removeBlock = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, { id }) => {
    const me = await requireStaff(ctx);
    const block = await ctx.db.get(id);
    if (!block) return;
    const rows = await ctx.db.query("occupancy").withIndex("by_block", (q) => q.eq("blockId", id)).collect();
    for (const r of rows) await ctx.db.delete(r._id);
    await ctx.db.delete(id);
    const room = await ctx.db.get(block.roomId);
    await audit(ctx, me, "block.remove", "blocks", id, `Room ${room?.number ?? "?"} unblocked from ${formatDateShort(block.startDate)}`);
  },
});
