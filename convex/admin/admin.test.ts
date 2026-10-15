import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import resendTest from "@convex-dev/resend/test";
import schema from "../schema";
import { modules } from "../../tests/convex-modules";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Phase 4 acceptance (docs/08): roles are enforced on the server, rate changes
// reach quotes at once, moves into occupied rooms are refused, photos need alt
// text, and the crons pick the right bookings.

// "Today" is Thursday 15 Oct 2026, 10:00 in Lagos.
const NOW = Date.UTC(2026, 9, 15, 9, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t, "rateLimiter");
  resendTest.register(t, "resend");
  await t.mutation(internal.seed.all, {});
  const mk = (email: string, role: "admin" | "staff", active = true) =>
    t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email });
      await ctx.db.insert("staffProfiles", { userId, email, name: email.split("@")[0], role, active });
      return userId;
    });
  const adminId = await mk("manager@selems.test", "admin");
  const staffId = await mk("desk@selems.test", "staff");
  const as = (userId: Id<"users">) => t.withIdentity({ subject: `${userId}|session` });
  return { t, admin: as(adminId), staff: as(staffId), adminId, staffId, as, mk };
}

async function error(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof ConvexError) return e.data as { code: string; message: string; field?: string };
    throw e;
  }
  throw new Error("expected an error");
}

const roomId = (t: Awaited<ReturnType<typeof setup>>["t"], number: string) =>
  t.run(async (ctx) => (await ctx.db.query("rooms").withIndex("by_number", (q) => q.eq("number", number)).unique())!._id);
const typeId = (t: Awaited<ReturnType<typeof setup>>["t"], slug: string) =>
  t.run(async (ctx) => (await ctx.db.query("roomTypes").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!);

const walkIn = { firstName: "Bola", lastName: "Ade", phone: "0803 555 0101" };

async function staffBooking(
  s: Awaited<ReturnType<typeof setup>>,
  slug: string,
  room: string,
  checkIn: string,
  checkOut: string,
  email?: string,
) {
  const type = await typeId(s.t, slug);
  return s.staff.action(api.admin.reservations.create, {
    roomTypeId: type._id,
    roomId: await roomId(s.t, room),
    checkIn,
    checkOut,
    adults: 1,
    children: 0,
    guest: { ...walkIn, email },
    source: "phone",
  });
}

describe("roles", () => {
  it("staff calling admin-only functions get FORBIDDEN", async () => {
    const s = await setup();
    const vip = await typeId(s.t, "vip-suite");
    expect((await error(s.staff.query(api.admin.rooms.getType, { id: vip._id }))).code).toBe("FORBIDDEN");
    expect((await error(s.staff.mutation(api.admin.rooms.setPublished, { id: vip._id, published: false }))).code).toBe("FORBIDDEN");
    expect((await error(s.staff.query(api.admin.settings.get, {}))).code).toBe("FORBIDDEN");
    expect((await error(s.staff.query(api.admin.staff.list, {}))).code).toBe("FORBIDDEN");
    expect((await error(s.staff.mutation(api.admin.staff.invite, { email: "x@selems.test", name: "X", role: "admin" }))).code).toBe("FORBIDDEN");
    expect((await error(s.staff.query(api.admin.content.list, {}))).code).toBe("FORBIDDEN");
    expect((await error(s.staff.mutation(api.admin.uploads.generateUploadUrl, {}))).code).toBe("FORBIDDEN");
    expect((await error(s.staff.query(api.admin.audit.list, {}))).code).toBe("FORBIDDEN");
    // …but can run the front desk.
    expect(Array.isArray(await s.staff.query(api.admin.reservations.list, { tab: "all" }))).toBe(true);
    expect((await s.staff.query(api.admin.dashboard.today, {})).kpis.month).toBeNull();
    expect((await s.admin.query(api.admin.dashboard.today, {})).kpis.month).not.toBeNull();
  });

  it("signed-out callers and deactivated staff are refused", async () => {
    const s = await setup();
    expect((await error(s.t.query(api.admin.reservations.list, { tab: "all" }))).code).toBe("UNAUTHENTICATED");
    const goneId = await s.mk("gone@selems.test", "staff", false);
    expect((await error(s.as(goneId).query(api.admin.reservations.list, { tab: "all" }))).code).toBe("FORBIDDEN");
  });

  it("an admin can't deactivate themselves or remove the last admin", async () => {
    const s = await setup();
    const me = await s.t.run(async (ctx) => (await ctx.db.query("staffProfiles").withIndex("by_email", (q) => q.eq("email", "manager@selems.test")).unique())!);
    expect((await error(s.admin.mutation(api.admin.staff.setActive, { id: me._id, active: false }))).code).toBe("CONFLICT");
    expect((await error(s.admin.mutation(api.admin.staff.setRole, { id: me._id, role: "staff" }))).code).toBe("CONFLICT");
  });

  it("deactivating someone ends their sessions", async () => {
    const s = await setup();
    const desk = await s.t.run(async (ctx) => (await ctx.db.query("staffProfiles").withIndex("by_email", (q) => q.eq("email", "desk@selems.test")).unique())!);
    await s.t.run((ctx) => ctx.db.insert("authSessions", { userId: desk.userId, expirationTime: NOW + 86_400_000 }));
    await s.admin.mutation(api.admin.staff.setActive, { id: desk._id, active: false });
    expect(await s.t.run((ctx) => ctx.db.query("authSessions").collect())).toHaveLength(0);
    expect((await error(s.staff.query(api.admin.reservations.list, { tab: "all" }))).code).toBe("FORBIDDEN");
  });
});

describe("rates", () => {
  it("a new rate reaches the public quote immediately and schedules a page refresh", async () => {
    const s = await setup();
    const vip = await typeId(s.t, "vip-suite");
    const stay = { roomTypeSlug: "vip-suite", checkIn: "2026-10-20", checkOut: "2026-10-21", adults: 1, children: 0 };
    const before = await s.t.query(api.public.booking.quote, stay);
    expect(before.ok && before.total).toBe(vip.baseRate);

    await s.admin.mutation(api.admin.rooms.updateType, {
      id: vip._id,
      name: vip.name,
      slug: vip.slug,
      category: vip.category,
      baseRate: 9_000_000,
      weekendRate: vip.weekendRate,
      maxAdults: vip.maxAdults,
      maxChildren: vip.maxChildren,
      sizeSqm: vip.sizeSqm,
      facts: vip.facts,
      amenities: vip.amenities,
      shortDescription: vip.shortDescription,
      description: vip.description,
      images: vip.images,
      featured: vip.featured,
    });
    const after = await s.t.query(api.public.booking.quote, stay);
    expect(after.ok && after.total).toBe(9_000_000);

    const scheduled = await s.t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    const revalidations = scheduled.filter((f) => f.name.includes("revalidate"));
    expect(revalidations.length).toBeGreaterThan(0);
    expect(revalidations.at(-1)!.args[0]).toMatchObject({ tags: expect.arrayContaining(["rooms", "room:vip-suite"]) });
    const audit = await s.t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(audit.at(-1)!.summary).toContain("weekday ₦70,000 → ₦90,000");
  });

  it("refuses overlapping special-date rates", async () => {
    const s = await setup();
    const vip = await typeId(s.t, "vip-suite");
    await s.admin.mutation(api.admin.rooms.createOverride, { roomTypeId: vip._id, startDate: "2026-12-20", endDate: "2027-01-03", rate: 8_500_000, label: "Festive season" });
    const e = await error(s.admin.mutation(api.admin.rooms.createOverride, { roomTypeId: vip._id, startDate: "2027-01-01", endDate: "2027-01-05", rate: 8_000_000, label: "New year" }));
    expect(e.code).toBe("CONFLICT");
    expect(e.message).toContain("Festive season");
  });

  it("renaming a slug keeps the old address as a redirect", async () => {
    const s = await setup();
    const vip = await typeId(s.t, "vip-suite");
    const { _id, _creationTime, updatedAt, sortOrder, published, slugRedirects, weekendRate, seoTitle, seoDescription, sizeSqm, ...rest } = vip;
    void _creationTime; void updatedAt; void sortOrder; void published; void slugRedirects;
    await s.admin.mutation(api.admin.rooms.updateType, { id: _id, ...rest, slug: "vip-suites", weekendRate, seoTitle, seoDescription, sizeSqm });
    expect(await s.t.query(api.public.rooms.bySlug, { slug: "vip-suite" })).toEqual({ redirectTo: "vip-suites" });
  });
});

describe("photos need alt text", () => {
  it("a live room type can't save a photo without a description", async () => {
    const s = await setup();
    const vip = await typeId(s.t, "vip-suite");
    const images = vip.images.map((img, i) => (i === 1 ? { ...img, alt: "  " } : img));
    const { _id, _creationTime, updatedAt, sortOrder, published, slugRedirects, ...rest } = vip;
    void _creationTime; void updatedAt; void sortOrder; void published; void slugRedirects;
    const e = await error(s.admin.mutation(api.admin.rooms.updateType, { id: _id, ...rest, images }));
    expect(e.code).toBe("INVALID_INPUT");
    expect(e.message).toContain("photo 2");
  });

  it("a draft room type can hold an undescribed photo but can't be published with it", async () => {
    const s = await setup();
    const id = await s.admin.mutation(api.admin.rooms.createType, { name: "Garden Room", category: "room" });
    const t = (await s.t.run((ctx) => ctx.db.get(id)))!;
    const { _id, _creationTime, updatedAt, sortOrder, published, slugRedirects, ...rest } = t;
    void _creationTime; void updatedAt; void sortOrder; void published; void slugRedirects;
    await s.admin.mutation(api.admin.rooms.updateType, {
      id: _id,
      ...rest,
      baseRate: 4_000_000,
      shortDescription: "A quiet room on the garden side.",
      description: "A quiet room on the garden side of the hotel.",
      images: [{ src: "/images/selems-hotel-akure-standard-room.jpg", alt: "", width: 2400, height: 1600 }],
    });
    const e = await error(s.admin.mutation(api.admin.rooms.setPublished, { id, published: true }));
    expect(e.message).toMatch(/needs a description/);
  });

  it("a gallery photo can't be published without alt text", async () => {
    const s = await setup();
    const [id] = await s.admin.mutation(api.admin.gallery.addMany, {
      images: [{ src: "/images/selems-hotel-akure-indoor-bar.jpg", alt: "", width: 2400, height: 1600 }],
      category: "bar",
    });
    const e = await error(s.admin.mutation(api.admin.gallery.update, { id, alt: "", caption: "The bar", category: "bar", published: true }));
    expect(e.code).toBe("INVALID_INPUT");
    await s.admin.mutation(api.admin.gallery.update, { id, alt: "Indoor bar with lounge chairs", caption: "The bar", category: "bar", published: true });
  });
});

describe("reservations", () => {
  it("moving a booking into an occupied room is refused with a clear message", async () => {
    const s = await setup();
    const first = await staffBooking(s, "vip-suite", "301", "2026-10-20", "2026-10-23");
    const second = await staffBooking(s, "vip-suite", "303", "2026-10-21", "2026-10-22");
    const e = await error(s.staff.mutation(api.admin.reservations.moveRoom, { id: second.id, roomId: await roomId(s.t, "301") }));
    expect(e.code).toBe("CONFLICT");
    expect(e.message).toBe(`Room 301 is taken by ${first.ref} on the night of 2026-10-21. Choose another room.`);
    // Nothing changed.
    const occ = await s.t.run((ctx) => ctx.db.query("occupancy").withIndex("by_booking", (q) => q.eq("bookingId", second.id)).collect());
    expect(occ.map((o) => o.roomId)).toEqual([await roomId(s.t, "303")]);
  });

  it("moves into a free room, and back-to-back stays may share a room", async () => {
    const s = await setup();
    await staffBooking(s, "vip-suite", "301", "2026-10-20", "2026-10-21");
    const b = await staffBooking(s, "vip-suite", "303", "2026-10-21", "2026-10-23");
    expect(await s.staff.mutation(api.admin.reservations.moveRoom, { id: b.id, roomId: await roomId(s.t, "301") })).toEqual({ roomNumber: "301" });
  });

  it("refuses to book a blocked room and to take a booked room out of service", async () => {
    const s = await setup();
    const r301 = await roomId(s.t, "301");
    await s.staff.mutation(api.admin.availability.createBlock, { roomId: r301, startDate: "2026-10-20", endDate: "2026-10-22", reason: "maintenance" });
    const e = await error(staffBooking(s, "vip-suite", "301", "2026-10-21", "2026-10-22"));
    expect(e.message).toContain("blocked");
    const b = await staffBooking(s, "vip-suite", "303", "2026-10-25", "2026-10-26");
    const oos = await error(s.admin.mutation(api.admin.rooms.setUnitStatus, { id: await roomId(s.t, "303"), status: "out_of_service" }));
    expect(oos.message).toContain(b.ref);
  });

  it("changes dates in one transaction and re-prices", async () => {
    const s = await setup();
    const b = await staffBooking(s, "vip-suite", "301", "2026-10-20", "2026-10-21");
    await s.staff.mutation(api.admin.reservations.changeDates, { id: b.id, checkIn: "2026-10-20", checkOut: "2026-10-22" });
    const booking = (await s.t.run((ctx) => ctx.db.get(b.id)))!;
    expect(booking.nights).toBe(2);
    expect(booking.nightly).toHaveLength(2);
    const occ = await s.t.run((ctx) => ctx.db.query("occupancy").withIndex("by_booking", (q) => q.eq("bookingId", b.id)).collect());
    expect(occ.map((o) => o.date).sort()).toEqual(["2026-10-20", "2026-10-21"]);
  });

  it("records payments, then blocks check-out while a balance is due unless a reason is given", async () => {
    const s = await setup();
    const b = await staffBooking(s, "standard-room", "101", "2026-10-15", "2026-10-17");
    await s.staff.mutation(api.admin.reservations.checkIn, { id: b.id });
    const booking = (await s.t.run((ctx) => ctx.db.get(b.id)))!;
    await s.staff.mutation(api.admin.reservations.recordPayment, { id: b.id, amount: booking.amountDue / 2, method: "cash" });
    expect((await s.t.run((ctx) => ctx.db.get(b.id)))!.paymentStatus).toBe("part_paid");
    expect((await error(s.staff.mutation(api.admin.reservations.recordPayment, { id: b.id, amount: booking.amountDue, method: "pos" }))).field).toBe("amount");
    expect((await error(s.staff.mutation(api.admin.reservations.checkOut, { id: b.id }))).field).toBe("overrideReason");
    await s.staff.mutation(api.admin.reservations.checkOut, { id: b.id, overrideReason: "Company will pay by transfer" });
    // Left on the first day: the second night is free again.
    const occ = await s.t.run((ctx) => ctx.db.query("occupancy").withIndex("by_booking", (q) => q.eq("bookingId", b.id)).collect());
    expect(occ).toHaveLength(0);
  });

  it("cancelling frees the room and is logged", async () => {
    const s = await setup();
    const b = await staffBooking(s, "penthouse", "302", "2026-10-20", "2026-10-21");
    await s.staff.mutation(api.admin.reservations.cancel, { id: b.id, reason: "Guest called to cancel" });
    expect(await s.t.run((ctx) => ctx.db.query("occupancy").collect())).toHaveLength(0);
    const events = await s.t.run((ctx) => ctx.db.query("bookingEvents").withIndex("by_booking", (q) => q.eq("bookingId", b.id)).collect());
    expect(events.map((e) => e.type)).toEqual(["created", "cancelled"]);
    expect(await s.t.run(async (ctx) => (await ctx.db.query("auditLog").collect()).map((a) => a.action))).toEqual(["booking.create", "booking.cancel"]);
  });
});

describe("crons", () => {
  const at = (hh: number, mm = 0) => Date.UTC(2026, 9, 15, hh - 1, mm); // Lagos time on 15 Oct

  it("flagLateArrivals flags today's unarrived guests only after the cut-off, once", async () => {
    const s = await setup();
    const today = await staffBooking(s, "vip-suite", "301", "2026-10-15", "2026-10-16");
    const tomorrow = await staffBooking(s, "vip-suite", "303", "2026-10-16", "2026-10-17");
    const arrived = await staffBooking(s, "standard-room", "101", "2026-10-15", "2026-10-16");
    await s.staff.mutation(api.admin.reservations.checkIn, { id: arrived.id });

    expect(await s.t.mutation(internal.jobs.flagLateArrivals, { now: at(19, 55) })).toEqual({ flagged: [], noShows: [] });
    expect(await s.t.mutation(internal.jobs.flagLateArrivals, { now: at(20, 5) })).toEqual({ flagged: [today.ref], noShows: [] });
    expect(await s.t.mutation(internal.jobs.flagLateArrivals, { now: at(21, 5) })).toEqual({ flagged: [], noShows: [] });
    expect((await s.t.run((ctx) => ctx.db.get(today.id)))!.lateArrivalFlag).toBe(true);
    expect((await s.t.run((ctx) => ctx.db.get(tomorrow.id)))!.lateArrivalFlag).toBeUndefined();
  });

  it("flagLateArrivals marks no-shows and frees the room when the hotel auto-cancels", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      const settings = (await ctx.db.query("settings").first())!;
      await ctx.db.patch(settings._id, { autoCancelNoShows: true });
    });
    const b = await staffBooking(s, "vip-suite", "301", "2026-10-15", "2026-10-17");
    expect(await s.t.mutation(internal.jobs.flagLateArrivals, { now: at(20, 5) })).toEqual({ flagged: [], noShows: [b.ref] });
    expect((await s.t.run((ctx) => ctx.db.get(b.id)))!.status).toBe("no_show");
    expect(await s.t.run((ctx) => ctx.db.query("occupancy").collect())).toHaveLength(0);
  });

  it("preArrivalReminders selects only tomorrow's reserved bookings with an email", async () => {
    const s = await setup();
    const yes = await staffBooking(s, "vip-suite", "301", "2026-10-16", "2026-10-18", "guest@example.com");
    await staffBooking(s, "vip-suite", "303", "2026-10-16", "2026-10-17"); // no email (walk-in)
    await staffBooking(s, "standard-room", "101", "2026-10-17", "2026-10-18", "later@example.com");
    const cancelled = await staffBooking(s, "standard-room", "102", "2026-10-16", "2026-10-17", "gone@example.com");
    await s.staff.mutation(api.admin.reservations.cancel, { id: cancelled.id, reason: "Changed plans" });
    expect(await s.t.mutation(internal.jobs.preArrivalReminders, { now: at(9) })).toEqual([yes.ref]);
  });

  it("expireInvites removes only expired, unused invites", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      await ctx.db.insert("invites", { email: "old@selems.test", role: "staff", expiresAt: NOW - 1 });
      await ctx.db.insert("invites", { email: "new@selems.test", role: "staff", expiresAt: NOW + 1000 });
      await ctx.db.insert("invites", { email: "used@selems.test", role: "staff", expiresAt: NOW - 1, usedAt: NOW - 5000 });
    });
    expect(await s.t.mutation(internal.jobs.expireInvites, {})).toBe(1);
  });
});

describe("content", () => {
  it("publishing a page validates fields and refreshes that page", async () => {
    const s = await setup();
    const page = (await s.admin.query(api.admin.content.get, { key: "rooms" }))!;
    const e = await error(s.admin.mutation(api.admin.content.publish, { key: "rooms", fields: { ...page.fields, h1: "" }, seoTitle: page.seoTitle, seoDescription: page.seoDescription }));
    expect(e.field).toBe("h1");
    await s.admin.mutation(api.admin.content.publish, { key: "rooms", fields: { ...page.fields, h1: "Rooms and suites in Akure" }, seoTitle: page.seoTitle, seoDescription: page.seoDescription });
    expect((await s.t.query(api.public.content.page, { key: "rooms" }))!.fields.h1).toBe("Rooms and suites in Akure");
  });

  it("drafts show only with a valid preview token", async () => {
    const s = await setup();
    process.env.REVALIDATE_SECRET = "test-secret";
    const page = (await s.admin.query(api.admin.content.get, { key: "gallery" }))!;
    await s.admin.mutation(api.admin.content.saveDraft, { key: "gallery", fields: { ...page.fields, h1: "Draft heading" }, seoTitle: page.seoTitle, seoDescription: page.seoDescription });
    expect((await s.t.query(api.public.content.page, { key: "gallery" }))!.fields.h1).not.toBe("Draft heading");
    const token = await s.admin.mutation(api.admin.content.previewToken, { key: "gallery" });
    expect((await s.t.query(api.public.content.pageDraft, { key: "gallery", token }))!.fields.h1).toBe("Draft heading");
    expect(await s.t.query(api.public.content.pageDraft, { key: "home", token })).toBeNull();
    expect(await s.t.query(api.public.content.pageDraft, { key: "gallery", token: token.replace(/.$/, "0") === token ? token.replace(/.$/, "1") : token.replace(/.$/, "0") })).toBeNull();
    delete process.env.REVALIDATE_SECRET;
  });
});
