import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { addDays, nowLagosHHmm, todayLagos } from "../lib/dates";
import { formatTime } from "../lib/format";
import { addBookingEvent, releaseNights } from "./lib/bookings";
import { getSettings } from "./lib/stays";

// Scheduled jobs (docs/04 "Crons"). Each takes an optional `now` so tests can
// run them at a fixed moment.

const nowArg = { now: v.optional(v.number()) };

/**
 * Hourly: guests due today who haven't arrived by the no-show cut-off are
 * flagged (and the front desk alerted once), or marked no-show if the hotel
 * auto-cancels.
 */
export const flagLateArrivals = internalMutation({
  args: nowArg,
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const settings = await getSettings(ctx);
    const today = todayLagos(now);
    if (nowLagosHHmm(now) < settings.noShowCutoff) return { flagged: [], noShows: [] };
    const due = await ctx.db
      .query("bookings")
      .withIndex("by_status_checkIn", (q) => q.eq("status", "reserved").eq("checkIn", today))
      .collect();
    const fresh = due.filter((b) => !b.lateArrivalFlag);
    const flagged: string[] = [];
    const noShows: string[] = [];
    for (const b of fresh) {
      if (settings.autoCancelNoShows) {
        await releaseNights(ctx, b._id);
        await ctx.db.patch(b._id, { status: "no_show", updatedAt: now });
        await addBookingEvent(ctx, b._id, "no_show", `Not arrived by ${settings.noShowCutoff}: marked as a no-show automatically and the room released.`);
        noShows.push(b.ref);
      } else {
        await ctx.db.patch(b._id, { lateArrivalFlag: true, updatedAt: now });
        await addBookingEvent(ctx, b._id, "late", `Not arrived by ${settings.noShowCutoff}. Flagged for the front desk.`);
        flagged.push(b.ref);
      }
    }
    if (flagged.length || noShows.length) {
      const names = fresh.map((b) => `${b.guest.firstName} ${b.guest.lastName} (${b.ref})`);
      await ctx.scheduler.runAfter(0, internal.emails.staffAlert, {
        title: noShows.length
          ? `${noShows.length} no-show${noShows.length === 1 ? "" : "s"} today`
          : `${flagged.length} guest${flagged.length === 1 ? "" : "s"} not arrived by ${formatTime(settings.noShowCutoff)}`,
        lines: [
          names.join(", "),
          noShows.length
            ? "The rooms have been released."
            : "Call them, then keep the room or mark a no-show from the Today screen.",
        ],
        path: "/admin",
        action: "Open Today",
        key: `late:${today}:${fresh.map((b) => b.ref).join(",")}`,
      });
    }
    return { flagged, noShows };
  },
});

/** Daily 09:00 Lagos: reminder to guests arriving tomorrow. */
export const preArrivalReminders = internalMutation({
  args: nowArg,
  handler: async (ctx, args) => {
    const tomorrow = addDays(todayLagos(args.now ?? Date.now()), 1);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_status_checkIn", (q) => q.eq("status", "reserved").eq("checkIn", tomorrow))
      .collect();
    const withEmail = bookings.filter((b) => b.guest.email);
    for (const b of withEmail) await ctx.scheduler.runAfter(0, internal.emails.preArrival, { bookingId: b._id });
    return withEmail.map((b) => b.ref);
  },
});

/** Daily 12:00 Lagos: one review request to guests who checked out yesterday. */
export const reviewRequests = internalMutation({
  args: nowArg,
  handler: async (ctx, args) => {
    const settings = await getSettings(ctx);
    if (!settings.googleReviewUrl) return [];
    const yesterday = addDays(todayLagos(args.now ?? Date.now()), -1);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_status_checkOut", (q) => q.eq("status", "checked_out").eq("checkOut", yesterday))
      .collect();
    const withEmail = bookings.filter((b) => b.guest.email);
    for (const b of withEmail) await ctx.scheduler.runAfter(0, internal.emails.reviewRequest, { bookingId: b._id });
    return withEmail.map((b) => b.ref);
  },
});

/** Daily: remove invites that expired without being used. */
export const expireInvites = internalMutation({
  args: nowArg,
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const invites = await ctx.db.query("invites").collect();
    const expired = invites.filter((i) => i.usedAt === undefined && i.expiresAt <= now);
    for (const i of expired) await ctx.db.delete(i._id);
    return expired.length;
  },
});
