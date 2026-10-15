import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import resendTest from "@convex-dev/resend/test";
import schema from "./schema";
import { modules } from "../tests/convex-modules";
import { api, internal } from "./_generated/api";
import { sha256Hex } from "./lib/refs";

// "Today" is Thursday 15 Oct 2026, 10:00 in Lagos.
const NOW = Date.UTC(2026, 9, 15, 9, 0);

const guest = { firstName: "Ada", lastName: "Obi", email: "ada@example.com", phone: "0803 123 4567" };
const stay = { checkIn: "2026-10-20", checkOut: "2026-10-22", adults: 2, children: 0 };

async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t, "rateLimiter");
  resendTest.register(t, "resend");
  await t.mutation(internal.seed.all, {});
  return t;
}

type T = Awaited<ReturnType<typeof setup>>;

const reserve = (t: T, overrides: Record<string, unknown> = {}) =>
  t.action(api.public.booking.reserve, {
    roomTypeSlug: "vip-suite",
    ...stay,
    guest,
    acceptedTerms: true,
    ...overrides,
  } as Parameters<typeof t.action<typeof api.public.booking.reserve>>[1]);

async function errorData(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof ConvexError) return e.data as { code: string; field?: string; message: string };
    throw e;
  }
  throw new Error("expected an error");
}

const createArgs = (slug: string, email: string) => ({
  roomTypeSlug: slug,
  ...stay,
  guest: { ...guest, email },
  manageToken: `token-${email}`,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("the booking transaction", () => {
  it("never double-books: two guests racing for the last room → one booking, one SOLD_OUT", async () => {
    const t = await setup();
    // The Penthouse has a single room.
    const results = await Promise.allSettled([
      t.mutation(internal.booking.create, createArgs("penthouse", "first@example.com")),
      t.mutation(internal.booking.create, createArgs("penthouse", "second@example.com")),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0].reason as ConvexError<{ code: string }>).data.code).toBe("SOLD_OUT");

    const bookings = await t.run((ctx) => ctx.db.query("bookings").collect());
    expect(bookings).toHaveLength(1);
    const occupancy = await t.run((ctx) => ctx.db.query("occupancy").collect());
    expect(occupancy.map((o) => o.date)).toEqual(["2026-10-20", "2026-10-21"]);
  });

  it("fills every room of a type, then reports sold out", async () => {
    const t = await setup();
    // VIP Suite has rooms 301 and 303.
    const a = await t.mutation(internal.booking.create, createArgs("vip-suite", "a@example.com"));
    const b = await t.mutation(internal.booking.create, createArgs("vip-suite", "b@example.com"));
    expect((await errorData(t.mutation(internal.booking.create, createArgs("vip-suite", "c@example.com")))).code).toBe("SOLD_OUT");
    const rooms = await t.run(async (ctx) => {
      const [x, y] = [await ctx.db.get(a.bookingId), await ctx.db.get(b.bookingId)];
      return [(await ctx.db.get(x!.roomId))!.number, (await ctx.db.get(y!.roomId))!.number];
    });
    expect(rooms).toEqual(["301", "303"]);
  });

  it("lets the next guest check in on the day the last one checks out", async () => {
    const t = await setup();
    await t.mutation(internal.booking.create, createArgs("penthouse", "a@example.com"));
    const next = await t.mutation(internal.booking.create, {
      ...createArgs("penthouse", "b@example.com"),
      checkIn: "2026-10-22",
      checkOut: "2026-10-24",
    });
    expect(next.ref).toBe("SLM-26-0002");
  });
});

describe("reserve (public)", () => {
  it("books a room, stores only the token hash, and queues the emails", async () => {
    const t = await setup();
    const { ref, token } = await reserve(t);
    expect(ref).toBe("SLM-26-0001");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const booking = await t.run((ctx) => ctx.db.query("bookings").withIndex("by_ref", (q) => q.eq("ref", ref)).unique());
    expect(booking).toMatchObject({
      status: "reserved",
      source: "website",
      paymentStatus: "unpaid",
      amountPaid: 0,
      amountDue: 14_000_000, // ₦70,000 × 2 weekday nights
      nights: 2,
      guest: { firstName: "Ada", lastName: "Obi", email: "ada@example.com", phone: "+2348031234567" },
      searchText: "ada obi +2348031234567 slm-26-0001",
    });
    expect(booking!.manageTokenHash).toBe(await sha256Hex(token));
    expect(JSON.stringify(booking)).not.toContain(token);

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name).sort()).toEqual(["emails:bookingConfirmation", "emails:staffNewBooking"]);
  });

  it("logs emails as not sent while no Resend key is configured", async () => {
    const t = await setup();
    await reserve(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const events = await t.run((ctx) => ctx.db.query("bookingEvents").collect());
    expect(events.map((e) => e.type).sort()).toEqual(["created", "email_skipped", "email_skipped"]);
  });

  it("rejects bad input with the field that's wrong", async () => {
    const t = await setup();
    expect(await errorData(reserve(t, { checkIn: "2026-10-14" }))).toMatchObject({ code: "INVALID_DATES", field: "checkIn" });
    expect(await errorData(reserve(t, { checkOut: "2026-10-20" }))).toMatchObject({ code: "INVALID_DATES", field: "checkOut" });
    expect(await errorData(reserve(t, { adults: 3 }))).toMatchObject({ code: "INVALID_INPUT", field: "adults" });
    expect(await errorData(reserve(t, { guest: { ...guest, phone: "123" } }))).toMatchObject({ field: "phone" });
    expect(await errorData(reserve(t, { guest: { ...guest, email: "ada@" } }))).toMatchObject({ field: "email" });
    expect(await errorData(reserve(t, { acceptedTerms: false }))).toMatchObject({ field: "acceptedTerms" });
    expect(await errorData(reserve(t, { specialRequests: "x".repeat(501) }))).toMatchObject({ field: "specialRequests" });
    expect(await errorData(reserve(t, { roomTypeSlug: "no-such-room" }))).toMatchObject({ code: "NOT_FOUND" });
    expect(await t.run((ctx) => ctx.db.query("bookings").collect())).toHaveLength(0);
  });

  it("rate-limits repeated bookings from one email", async () => {
    const t = await setup();
    for (let i = 0; i < 5; i++) {
      await reserve(t, { roomTypeSlug: "standard-room", checkIn: `2026-11-0${i + 1}`, checkOut: `2026-11-0${i + 2}` });
    }
    expect((await errorData(reserve(t, { roomTypeSlug: "standard-room", checkIn: "2026-11-20", checkOut: "2026-11-21" }))).code).toBe(
      "RATE_LIMITED",
    );
  });
});

describe("search and quote", () => {
  it("lists every published room with availability, sold-out rooms last", async () => {
    const t = await setup();
    await t.mutation(internal.booking.create, createArgs("penthouse", "a@example.com"));
    const res = await t.query(api.public.booking.search, stay);
    if (!res.ok) throw new Error(res.error.message);
    expect(res.nights).toBe(2);
    expect(res.results).toHaveLength(9);
    expect(res.results.at(-1)).toMatchObject({ slug: "penthouse", available: 0 });
    expect(res.results[0]).toMatchObject({ slug: "standard-room", available: 4, total: 7_000_000 });
    expect(res.results[0].cover?.alt).toBeTruthy();
  });

  it("returns an error object (not a throw) for bad dates", async () => {
    const t = await setup();
    const res = await t.query(api.public.booking.search, { ...stay, checkOut: stay.checkIn });
    expect(res).toMatchObject({ ok: false, error: { code: "INVALID_DATES" } });
  });

  it("applies the long-weekend offer automatically to a qualifying stay", async () => {
    const t = await setup();
    // Friday 23 → Monday 26 Oct, Standard Room: 3 × ₦35,000 = ₦105,000 → offer ₦100,000.
    const q = await t.query(api.public.booking.quote, {
      roomTypeSlug: "standard-room",
      checkIn: "2026-10-23",
      checkOut: "2026-10-26",
      adults: 2,
      children: 0,
    });
    expect(q).toMatchObject({ ok: true, total: 10_000_000, offer: { slug: "long-weekend" } });
    // Arriving Saturday doesn't qualify.
    const sat = await t.query(api.public.booking.quote, { roomTypeSlug: "standard-room", checkIn: "2026-10-24", checkOut: "2026-10-27", adults: 2, children: 0 });
    expect(sat).toMatchObject({ ok: true, total: 10_500_000, offer: null });
  });

  it("prices special-date rates and books at the quoted price", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      const vip = await ctx.db.query("roomTypes").withIndex("by_slug", (q) => q.eq("slug", "vip-suite")).unique();
      await ctx.db.insert("rateOverrides", { roomTypeId: vip!._id, startDate: "2026-10-21", endDate: "2026-10-21", rate: 9_000_000, label: "Convocation" });
    });
    const q = await t.query(api.public.booking.quote, { roomTypeSlug: "vip-suite", ...stay });
    expect(q).toMatchObject({ ok: true, total: 16_000_000 });
    const { ref } = await reserve(t);
    const booking = await t.run((ctx) => ctx.db.query("bookings").withIndex("by_ref", (q2) => q2.eq("ref", ref)).unique());
    expect(booking!.amountDue).toBe(16_000_000);
    expect(booking!.nightly.map((n) => n.reason)).toEqual(["standard", "Convocation"]);
  });
});

describe("guest manage link", () => {
  it("shows the booking only with the right token, and never says why not", async () => {
    const t = await setup();
    const { ref, token } = await reserve(t);
    const view = await t.query(api.public.booking.forGuest, { ref, token });
    expect(view).toMatchObject({ ref, status: "reserved", amountDue: 14_000_000, canCancel: true, room: { name: "VIP Suite" } });
    expect(await t.query(api.public.booking.forGuest, { ref, token: token.slice(1) + "x" })).toBeNull();
    expect(await t.query(api.public.booking.forGuest, { ref: "SLM-26-9999", token })).toBeNull();
    expect(await t.query(api.public.booking.forGuest, { ref: ref.toLowerCase(), token })).not.toBeNull();
  });

  it("lets the guest cancel, frees the room, and refuses a second cancel", async () => {
    const t = await setup();
    const { ref, token } = await reserve(t, { roomTypeSlug: "penthouse" });
    expect((await t.query(api.public.booking.quote, { roomTypeSlug: "penthouse", ...stay }))).toMatchObject({ available: 0 });

    await t.mutation(api.public.booking.cancelByGuest, { ref, token });
    const booking = await t.run((ctx) => ctx.db.query("bookings").withIndex("by_ref", (q) => q.eq("ref", ref)).unique());
    expect(booking).toMatchObject({ status: "cancelled", cancelledReason: "Cancelled by the guest online" });
    expect(await t.run((ctx) => ctx.db.query("occupancy").collect())).toHaveLength(0);
    expect((await t.query(api.public.booking.quote, { roomTypeSlug: "penthouse", ...stay }))).toMatchObject({ available: 1 });

    expect((await errorData(t.mutation(api.public.booking.cancelByGuest, { ref, token }))).code).toBe("CONFLICT");
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name)).toContain("emails:bookingCancelled");
  });

  it("refuses a wrong token without revealing the booking", async () => {
    const t = await setup();
    const { ref } = await reserve(t);
    expect((await errorData(t.mutation(api.public.booking.cancelByGuest, { ref, token: "nope" }))).code).toBe("NOT_FOUND");
  });

  it("closes online cancellation at the policy deadline", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      const s = await ctx.db.query("settings").first();
      await ctx.db.patch(s!._id, { checkInTime: "14:00", freeCancellationHours: 48 });
    });
    // Check-in Sat 17 Oct 14:00 Lagos; deadline Thu 15 Oct 14:00 Lagos = 13:00 UTC.
    const { ref, token } = await reserve(t, { checkIn: "2026-10-17", checkOut: "2026-10-18" });
    expect((await t.query(api.public.booking.forGuest, { ref, token }))?.canCancel).toBe(true);

    vi.setSystemTime(Date.UTC(2026, 9, 15, 13, 0)); // exactly at the deadline
    expect((await t.query(api.public.booking.forGuest, { ref, token }))?.canCancel).toBe(false);
    expect((await errorData(t.mutation(api.public.booking.cancelByGuest, { ref, token }))).code).toBe("CONFLICT");
  });
});
