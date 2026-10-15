import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { modules } from "../tests/convex-modules";
import { internal } from "./_generated/api";
import seed from "../content/seed.json";

const TABLES = ["settings", "roomTypes", "rooms", "offers", "facilities", "faqs", "galleryImages", "pages"] as const;

describe("seed:all", () => {
  it("is idempotent: a second run inserts nothing", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.seed.all, {});
    const countsAfterFirst = await t.run(async (ctx) =>
      Object.fromEntries(await Promise.all(TABLES.map(async (n) => [n, (await ctx.db.query(n).collect()).length]))),
    );
    const second = await t.mutation(internal.seed.all, {});
    const third = await t.mutation(internal.seed.all, { overwrite: true });
    const countsAfterAll = await t.run(async (ctx) =>
      Object.fromEntries(await Promise.all(TABLES.map(async (n) => [n, (await ctx.db.query(n).collect()).length]))),
    );

    expect(countsAfterFirst).toEqual({
      settings: 1,
      roomTypes: seed.roomTypes.length,
      rooms: 23,
      offers: seed.offers.length,
      facilities: seed.facilities.length,
      faqs: seed.faqs.length,
      galleryImages: seed.gallery.length,
      pages: Object.keys(seed.pages).length,
    });
    expect(countsAfterAll).toEqual(countsAfterFirst);
    for (const table of Object.values(second)) expect(table.inserted).toBe(0);
    for (const table of Object.values(third)) expect(table.inserted).toBe(0);
    expect(first.roomTypes.inserted).toBe(9);
  });

  it("keeps anything marked [CONFIRM] unpublished", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.all, {});
    await t.run(async (ctx) => {
      const offers = await ctx.db.query("offers").collect();
      for (const o of offers) if (JSON.stringify(o).includes("[CONFIRM")) expect(o.published).toBe(false);
      const facilities = await ctx.db.query("facilities").collect();
      for (const f of facilities) if (JSON.stringify(f).includes("[CONFIRM")) expect(f.published).toBe(false);
      const faqs = await ctx.db.query("faqs").collect();
      for (const f of faqs) if (JSON.stringify(f).includes("[CONFIRM")) expect(f.published).toBe(false);
      const roomTypes = await ctx.db.query("roomTypes").collect();
      for (const r of roomTypes) if (JSON.stringify(r).includes("[CONFIRM")) expect(r.published).toBe(false);
      const settings = await ctx.db.query("settings").first();
      expect(JSON.stringify(settings)).not.toContain("[CONFIRM");
      expect(settings?.checkInTime).toBeUndefined(); // unset until the hotel confirms
    });
  });

  it("stores money as integer kobo and every image with alt text and size", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.all, {});
    await t.run(async (ctx) => {
      const roomTypes = await ctx.db.query("roomTypes").collect();
      expect(roomTypes.map((r) => r.baseRate)).toEqual(
        [3_500_000, 4_000_000, 4_500_000, 5_000_000, 5_500_000, 6_000_000, 6_500_000, 7_000_000, 7_500_000],
      );
      const images = [
        ...roomTypes.flatMap((r) => r.images),
        ...(await ctx.db.query("galleryImages").collect()).map((g) => g.image),
        ...(await ctx.db.query("facilities").collect()).flatMap((f) => (f.image ? [f.image] : [])),
      ];
      expect(images.length).toBeGreaterThan(19);
      for (const img of images) {
        expect(img.alt.trim().length).toBeGreaterThan(10);
        expect(img.width).toBeGreaterThan(0);
        expect(img.height).toBeGreaterThan(0);
      }
      const vip = await ctx.db.query("galleryImages").withIndex("by_src", (q) => q.eq("image.src", "/images/selems-hotel-akure-vip-suite-bed.jpg")).unique();
      expect(vip?.roomTypeId).toBeDefined();
    });
  });

  it("does not overwrite staff edits unless asked", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.all, {});
    await t.run(async (ctx) => {
      const vip = await ctx.db.query("roomTypes").withIndex("by_slug", (q) => q.eq("slug", "vip-suite")).unique();
      await ctx.db.patch(vip!._id, { baseRate: 8_000_000 });
    });
    await t.mutation(internal.seed.all, {});
    const rate = await t.run(async (ctx) => (await ctx.db.query("roomTypes").withIndex("by_slug", (q) => q.eq("slug", "vip-suite")).unique())!.baseRate);
    expect(rate).toBe(8_000_000);
  });
});
