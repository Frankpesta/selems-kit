import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { modules } from "../../tests/convex-modules";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { eachNight } from "../../lib/dates";
import { freeRoomsOfType, isRoomFree } from "./availability";

async function setup(ctx: MutationCtx) {
  const userId = await ctx.db.insert("users", { email: "desk@selems.test" });
  const roomTypeId = await ctx.db.insert("roomTypes", {
    name: "VIP Suite",
    slug: "vip-suite",
    category: "suite",
    sortOrder: 1,
    featured: false,
    shortDescription: "",
    description: "",
    facts: [],
    amenities: [],
    maxAdults: 2,
    maxChildren: 1,
    baseRate: 7_000_000,
    images: [],
    published: true,
    updatedAt: 0,
  });
  const room = (number: string, status: "active" | "out_of_service" = "active") =>
    ctx.db.insert("rooms", { number, roomTypeId, status });
  // Inserted out of order to prove results are sorted numerically.
  const r310 = await room("310");
  const r302 = await room("302");
  const r9 = await room("9");
  return { userId, roomTypeId, r9, r302, r310, room };
}

async function occupy(ctx: MutationCtx, roomId: Id<"rooms">, checkIn: string, checkOut: string, extra = {}) {
  for (const date of eachNight(checkIn, checkOut)) {
    await ctx.db.insert("occupancy", { roomId, date, ...extra });
  }
}

async function insertBooking(ctx: MutationCtx, roomTypeId: Id<"roomTypes">, roomId: Id<"rooms">, checkIn: string, checkOut: string) {
  const bookingId = await ctx.db.insert("bookings", {
    ref: "SLM-26-0001",
    roomTypeId,
    roomId,
    checkIn,
    checkOut,
    nights: eachNight(checkIn, checkOut).length,
    adults: 1,
    children: 0,
    guest: { firstName: "Ada", lastName: "Obi", email: "ada@example.com", phone: "+2348031234567" },
    source: "website",
    status: "reserved",
    nightly: [],
    amountDue: 0,
    amountPaid: 0,
    paymentStatus: "unpaid",
    manageTokenHash: "x",
    searchText: "",
    createdAt: 0,
    updatedAt: 0,
  });
  await occupy(ctx, roomId, checkIn, checkOut, { bookingId });
  return bookingId;
}

const numbers = (rooms: { number: string }[]) => rooms.map((r) => r.number);

describe("freeRoomsOfType", () => {
  it("returns every active room, sorted by number, when nothing is booked", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { roomTypeId } = await setup(ctx);
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-20", "2026-10-22"))).toEqual(["9", "302", "310"]);
    });
  });

  it("excludes a room booked on any overlapping night", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { roomTypeId, r9 } = await setup(ctx);
      await occupy(ctx, r9, "2026-10-20", "2026-10-23"); // nights 20, 21, 22
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-22", "2026-10-24"))).toEqual(["302", "310"]);
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-18", "2026-10-21"))).toEqual(["302", "310"]);
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-15", "2026-10-30"))).toEqual(["302", "310"]);
    });
  });

  it("allows check-in on another guest's checkout day (adjacent stays)", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { roomTypeId, r9 } = await setup(ctx);
      await occupy(ctx, r9, "2026-10-20", "2026-10-23");
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-23", "2026-10-25"))).toContain("9");
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-18", "2026-10-20"))).toContain("9");
    });
  });

  it("treats blocked nights as taken", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { roomTypeId, r302, userId } = await setup(ctx);
      const blockId = await ctx.db.insert("blocks", {
        roomId: r302,
        startDate: "2026-10-21",
        endDate: "2026-10-22",
        reason: "maintenance",
        createdBy: userId,
      });
      await occupy(ctx, r302, "2026-10-21", "2026-10-22", { blockId });
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-20", "2026-10-22"))).toEqual(["9", "310"]);
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-22", "2026-10-23"))).toContain("302");
    });
  });

  it("never offers out-of-service rooms", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { roomTypeId, r310, room } = await setup(ctx);
      await ctx.db.patch(r310, { status: "out_of_service" });
      await room("400", "out_of_service");
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-20", "2026-10-21"))).toEqual(["9", "302"]);
      expect(await isRoomFree(ctx, r310, "2026-10-20", "2026-10-21")).toBe(false);
    });
  });

  it("is sold out when every room is taken", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { roomTypeId, r9, r302, r310 } = await setup(ctx);
      for (const r of [r9, r302, r310]) await occupy(ctx, r, "2026-10-20", "2026-10-21");
      expect(await freeRoomsOfType(ctx, roomTypeId, "2026-10-20", "2026-10-21")).toEqual([]);
    });
  });

  it("ignores a booking's own nights when staff move it", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const { roomTypeId, r9 } = await setup(ctx);
      const bookingId = await insertBooking(ctx, roomTypeId, r9, "2026-10-20", "2026-10-23");
      expect(await isRoomFree(ctx, r9, "2026-10-21", "2026-10-24")).toBe(false);
      expect(await isRoomFree(ctx, r9, "2026-10-21", "2026-10-24", bookingId)).toBe(true);
      expect(numbers(await freeRoomsOfType(ctx, roomTypeId, "2026-10-21", "2026-10-24", bookingId))).toContain("9");
    });
  });
});
