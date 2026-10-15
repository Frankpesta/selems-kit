import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { addDays, isWeekendNight, nowLagosHHmm, todayLagos } from "../../lib/dates";
import { requireStaff } from "../lib/auth";
import { getSettings } from "../lib/stays";
import { attentionReason, bookingRow, loadMaps } from "./reservations";

// Today screen (docs/06): the front desk's view of arrivals, departures and
// anything that needs a person. Revenue figures are for admins only.

const activeRoomCount = async (ctx: QueryCtx) =>
  (await ctx.db.query("rooms").collect()).filter((r) => r.status === "active").length;

/** Rooms sold (booking nights, not blocks) on a night. */
async function roomsSold(ctx: QueryCtx, date: string) {
  const rows = await ctx.db.query("occupancy").withIndex("by_date", (q) => q.eq("date", date)).collect();
  return rows.filter((r) => r.bookingId).length;
}

const monthStart = (d: string) => `${d.slice(0, 7)}-01`;

export const today = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireStaff(ctx);
    const settings = await getSettings(ctx);
    const today = todayLagos();
    const now = nowLagosHHmm();
    const maps = await loadMaps(ctx);
    const cutoff = settings.noShowCutoff;

    const arriving = (await ctx.db.query("bookings").withIndex("by_checkIn", (q) => q.eq("checkIn", today)).collect()).filter(
      (b) => b.status === "reserved" || b.status === "checked_in",
    );
    const leaving = (await ctx.db.query("bookings").withIndex("by_checkOut", (q) => q.eq("checkOut", today)).collect()).filter(
      (b) => b.status === "checked_in" || b.status === "checked_out",
    );
    const lateCheckout = (b: Doc<"bookings">) =>
      b.status === "checked_in" && !!settings.checkOutTime && now > settings.checkOutTime;

    const activeRooms = await activeRoomCount(ctx);
    const soldTonight = await roomsSold(ctx, today);

    // Needs attention.
    const reserved = await ctx.db.query("bookings").withIndex("by_status_checkIn", (q) => q.eq("status", "reserved").lte("checkIn", today)).collect();
    const inHouse = await ctx.db.query("bookings").withIndex("by_status_checkIn", (q) => q.eq("status", "checked_in")).collect();
    const late = [...reserved, ...inHouse]
      .map((b) => ({ b, reason: attentionReason(b, today, cutoff, now) }))
      .filter((x) => x.reason && !x.reason.startsWith("New"));
    const dayAgo = Date.now() - 86_400_000;
    const unseen = (await ctx.db.query("bookings").withIndex("by_status_checkIn", (q) => q.eq("status", "reserved").gte("checkIn", today)).collect()).filter(
      (b) => b.source === "website" && b.viewedAt === undefined && b.createdAt >= dayAgo,
    );
    const newInquiries = await ctx.db.query("inquiries").withIndex("by_status", (q) => q.eq("status", "new")).collect();
    const pendingReviews = (await ctx.db.query("reviews").collect()).filter((r) => !r.approved);
    const outOfService = (await ctx.db.query("rooms").collect()).filter((r) => r.status === "out_of_service");

    // Admin only: amount due for nights this month and room nights sold.
    let month: { amountDue: number; roomNights: number; label: string } | null = null;
    if (me.role === "admin") {
      let amountDue = 0;
      let roomNights = 0;
      const cache = new Map<Id<"bookings">, Doc<"bookings"> | null>();
      for (let d = monthStart(today); d.slice(0, 7) === today.slice(0, 7); d = addDays(d, 1)) {
        const rows = await ctx.db.query("occupancy").withIndex("by_date", (q) => q.eq("date", d)).collect();
        for (const row of rows) {
          if (!row.bookingId) continue;
          if (!cache.has(row.bookingId)) cache.set(row.bookingId, await ctx.db.get(row.bookingId));
          const b = cache.get(row.bookingId);
          const line = b?.nightly.find((n) => n.date === d);
          roomNights += 1;
          amountDue += line?.rate ?? 0;
        }
      }
      month = { amountDue, roomNights, label: new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(Date.parse(`${today}T00:00:00Z`)) };
    }

    return {
      today,
      now,
      cutoff,
      role: me.role,
      kpis: {
        arrivals: arriving.length,
        arrivalsCheckedIn: arriving.filter((b) => b.status === "checked_in").length,
        departures: leaving.length,
        lateCheckouts: leaving.filter(lateCheckout).length,
        inHouse: soldTonight,
        activeRooms,
        occupancy: activeRooms ? Math.round((soldTonight / activeRooms) * 100) : 0,
        month,
      },
      arrivals: arriving
        .sort((a, b) => (a.arrivalWindow ?? "99").localeCompare(b.arrivalWindow ?? "99"))
        .map((b) => bookingRow(b, maps, attentionReason(b, today, cutoff, now))),
      departures: leaving.map((b) => ({ ...bookingRow(b, maps), lateCheckout: lateCheckout(b) })),
      attention: {
        late: late.map(({ b, reason }) => ({ ...bookingRow(b, maps), reason: reason! })),
        unseen: unseen.map((b) => bookingRow(b, maps)),
        inquiries: newInquiries.length,
        latestInquiry: newInquiries.sort((a, b) => b.createdAt - a.createdAt)[0]
          ? { name: newInquiries[0].name, subject: newInquiries[0].subject, createdAt: newInquiries[0].createdAt }
          : null,
        reviews: pendingReviews.length,
        outOfService: outOfService.map((r) => ({ id: r._id, number: r.number, note: r.notes ?? null })),
      },
    };
  },
});

/** Occupancy for the next 14 nights (bar chart). */
export const occupancyNext14 = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const today = todayLagos();
    const activeRooms = await activeRoomCount(ctx);
    const nights = [];
    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const sold = await roomsSold(ctx, date);
      nights.push({ date, sold, percent: activeRooms ? Math.round((sold / activeRooms) * 100) : 0, weekend: isWeekendNight(date) });
    }
    return { activeRooms, nights };
  },
});

/** Sidebar badges. */
export const navCounts = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireStaff(ctx);
    const settings = await getSettings(ctx);
    const today = todayLagos();
    const now = nowLagosHHmm();
    const reserved = await ctx.db.query("bookings").withIndex("by_status_checkIn", (q) => q.eq("status", "reserved")).collect();
    const inHouse = await ctx.db.query("bookings").withIndex("by_status_checkIn", (q) => q.eq("status", "checked_in")).collect();
    const attention = [...reserved, ...inHouse].filter((b) => attentionReason(b, today, settings.noShowCutoff, now)).length;
    const inquiries = (await ctx.db.query("inquiries").withIndex("by_status", (q) => q.eq("status", "new")).collect()).length;
    const reviews = me.role === "admin" ? (await ctx.db.query("reviews").collect()).filter((r) => !r.approved).length : 0;
    return { attention, inquiries, reviews };
  },
});
