import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { addDays, isDateString, todayLagos } from "../../lib/dates";
import { formatDateShort } from "../../lib/format";
import { requireAdmin, requireStaff } from "../lib/auth";
import { audit, revalidate } from "../lib/audit";
import { appError } from "../lib/errors";
import { imageUrl, type StoredImage } from "../lib/images";
import { assertKoboAmount, naira } from "../lib/staffBookings";
import { assertImagesHaveAlt, cleanImages, isSlug } from "../lib/adminValidators";
import { image } from "../schema";

// Rooms & rates (docs/06). Admin only, except the room list staff need for
// bookings and the availability grid.

const roomTags = (...slugs: (string | undefined)[]) => ["rooms", "faqs", "offers", ...slugs.filter(Boolean).map((s) => `room:${s}`)];

const fromRate = (t: Doc<"roomTypes">) => (t.weekendRate != null ? Math.min(t.baseRate, t.weekendRate) : t.baseRate);

const adminImages = (ctx: QueryCtx, images: StoredImage[]) =>
  Promise.all(images.map(async (img) => ({ ...img, url: await imageUrl(ctx, img) })));

/** Room types for the Rooms & rates table. */
export const listTypes = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const types = await ctx.db.query("roomTypes").withIndex("by_sort").collect();
    const rooms = await ctx.db.query("rooms").collect();
    return types.map((t) => {
      const units = rooms.filter((r) => r.roomTypeId === t._id);
      return {
        id: t._id,
        name: t.name,
        slug: t.slug,
        category: t.category,
        published: t.published,
        featured: t.featured,
        sortOrder: t.sortOrder,
        baseRate: t.baseRate,
        weekendRate: t.weekendRate ?? null,
        fromRate: fromRate(t),
        maxAdults: t.maxAdults,
        maxChildren: t.maxChildren,
        unitsActive: units.filter((u) => u.status === "active").length,
        unitsTotal: units.length,
        photos: t.images.length,
        photosMissingAlt: t.images.filter((i) => !i.alt.trim()).length,
      };
    });
  },
});

export const getType = query({
  args: { id: v.id("roomTypes") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const t = await ctx.db.get(id);
    if (!t) return null;
    const overrides = await ctx.db.query("rateOverrides").withIndex("by_type_start", (q) => q.eq("roomTypeId", id)).collect();
    const amenities = new Set<string>();
    for (const other of await ctx.db.query("roomTypes").collect()) other.amenities.forEach((a) => amenities.add(a));
    return {
      ...t,
      images: await adminImages(ctx, t.images),
      overrides: overrides.sort((a, b) => a.startDate.localeCompare(b.startDate)),
      amenityOptions: [...amenities].sort(),
    };
  },
});

export const createType = mutation({
  args: { name: v.string(), category: v.union(v.literal("room"), v.literal("suite")) },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const name = args.name.trim();
    if (!name || name.length > 60) throw appError("INVALID_INPUT", "Enter a room name.", "name");
    const base = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "room";
    let slug = base;
    for (let i = 2; await slugTaken(ctx, slug); i++) slug = `${base}-${i}`;
    const last = await ctx.db.query("roomTypes").withIndex("by_sort").order("desc").first();
    const id = await ctx.db.insert("roomTypes", {
      name,
      slug,
      category: args.category,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      featured: false,
      shortDescription: "",
      description: "",
      facts: [],
      amenities: [],
      maxAdults: 2,
      maxChildren: 0,
      baseRate: 0,
      images: [],
      published: false,
      updatedAt: Date.now(),
    });
    await audit(ctx, me, "roomType.create", "roomTypes", id, name);
    return id;
  },
});

async function slugTaken(ctx: QueryCtx, slug: string, except?: Id<"roomTypes">) {
  const all = await ctx.db.query("roomTypes").collect();
  return all.some((t) => t._id !== except && (t.slug === slug || t.slugRedirects?.includes(slug)));
}

/** What stops a room type going live on the website, or null. */
export function publishProblem(t: Pick<Doc<"roomTypes">, "images" | "baseRate" | "shortDescription" | "description" | "name">) {
  if (t.baseRate <= 0) return "Set a weekday rate first.";
  if (!t.shortDescription.trim() || !t.description.trim()) return "Write the card and page descriptions first.";
  if (t.images.length === 0) return "Add at least one photo first.";
  const missing = t.images.findIndex((i) => !i.alt.trim());
  if (missing >= 0) return `Photo ${missing + 1} needs a description (alt text) before ${t.name} can go live.`;
  return null;
}

export const updateType = mutation({
  args: {
    id: v.id("roomTypes"),
    name: v.string(),
    slug: v.string(),
    category: v.union(v.literal("room"), v.literal("suite")),
    baseRate: v.number(),
    weekendRate: v.optional(v.number()),
    maxAdults: v.number(),
    maxChildren: v.number(),
    sizeSqm: v.optional(v.number()),
    facts: v.array(v.string()),
    amenities: v.array(v.string()),
    shortDescription: v.string(),
    description: v.string(),
    images: v.array(image),
    featured: v.boolean(),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const t = await ctx.db.get(args.id);
    if (!t) throw appError("NOT_FOUND", "That room type doesn't exist.");
    const name = args.name.trim();
    if (!name || name.length > 60) throw appError("INVALID_INPUT", "Enter a room name.", "name");
    const slug = args.slug.trim().toLowerCase().replace(/^\/?rooms\//, "");
    if (!isSlug(slug)) throw appError("INVALID_INPUT", "Use lower-case letters, numbers and hyphens, e.g. vip-suite.", "slug");
    if (slug !== t.slug && (await slugTaken(ctx, slug, t._id))) throw appError("CONFLICT", "Another room already uses that address.", "slug");
    assertKoboAmount(args.baseRate, "baseRate", "weekday rate");
    if (args.weekendRate !== undefined) assertKoboAmount(args.weekendRate, "weekendRate", "weekend rate");
    for (const [field, n, max] of [["maxAdults", args.maxAdults, 12], ["maxChildren", args.maxChildren, 12]] as const) {
      if (!Number.isInteger(n) || n < (field === "maxAdults" ? 1 : 0) || n > max) throw appError("INVALID_INPUT", "Enter a whole number of guests.", field);
    }
    if (args.sizeSqm !== undefined && !(args.sizeSqm > 0 && args.sizeSqm < 1000)) throw appError("INVALID_INPUT", "Enter the size in square metres, or leave it blank.", "sizeSqm");
    const images = cleanImages(args.images);
    if (t.published) assertImagesHaveAlt(images, `${name} is live on the website, so every photo`);
    const shortDescription = args.shortDescription.trim();
    const description = args.description.trim();
    if (shortDescription.length > 240) throw appError("INVALID_INPUT", "Keep the card description under 240 characters.", "shortDescription");
    if (t.published && (!shortDescription || !description)) throw appError("INVALID_INPUT", "A live room needs both descriptions.", "description");
    if (t.published && images.length === 0) throw appError("INVALID_INPUT", "A live room needs at least one photo.", "images");

    const slugRedirects = slug !== t.slug ? [...new Set([...(t.slugRedirects ?? []), t.slug])].filter((s) => s !== slug) : t.slugRedirects;
    await ctx.db.patch(t._id, {
      name,
      slug,
      slugRedirects,
      category: args.category,
      baseRate: args.baseRate,
      weekendRate: args.weekendRate,
      maxAdults: args.maxAdults,
      maxChildren: args.maxChildren,
      sizeSqm: args.sizeSqm,
      facts: args.facts.map((f) => f.trim()).filter(Boolean).slice(0, 12),
      amenities: [...new Set(args.amenities.map((a) => a.trim()).filter(Boolean))].slice(0, 40),
      shortDescription,
      description,
      images,
      featured: args.featured,
      seoTitle: args.seoTitle?.trim() || undefined,
      seoDescription: args.seoDescription?.trim() || undefined,
      updatedAt: Date.now(),
    });
    const changes = [
      t.baseRate !== args.baseRate ? `weekday ${naira(t.baseRate)} → ${naira(args.baseRate)}` : null,
      (t.weekendRate ?? null) !== (args.weekendRate ?? null) ? `weekend → ${args.weekendRate ? naira(args.weekendRate) : "same as weekday"}` : null,
      slug !== t.slug ? `address /rooms/${t.slug} → /rooms/${slug}` : null,
    ].filter(Boolean);
    await audit(ctx, me, "roomType.update", "roomTypes", t._id, `${name}${changes.length ? `: ${changes.join(", ")}` : ""}`);
    await revalidate(ctx, roomTags(t.slug, slug));
    return { slug };
  },
});

export const setPublished = mutation({
  args: { id: v.id("roomTypes"), published: v.boolean() },
  handler: async (ctx, { id, published }) => {
    const me = await requireAdmin(ctx);
    const t = await ctx.db.get(id);
    if (!t) throw appError("NOT_FOUND", "That room type doesn't exist.");
    if (published) {
      const problem = publishProblem(t);
      if (problem) throw appError("INVALID_INPUT", problem, "published");
    }
    await ctx.db.patch(id, { published, updatedAt: Date.now() });
    await audit(ctx, me, published ? "roomType.publish" : "roomType.unpublish", "roomTypes", id, t.name);
    await revalidate(ctx, roomTags(t.slug));
  },
});

export const reorder = mutation({
  args: { ids: v.array(v.id("roomTypes")) },
  handler: async (ctx, { ids }) => {
    const me = await requireAdmin(ctx);
    for (const [i, id] of ids.entries()) await ctx.db.patch(id, { sortOrder: i + 1 });
    await audit(ctx, me, "roomType.reorder", "roomTypes", "all", "Room order changed");
    await revalidate(ctx, roomTags());
  },
});

// ─── Special-date rates ──────────────────────────────────────────────────────

async function assertNoOverlap(ctx: QueryCtx, roomTypeId: Id<"roomTypes">, startDate: string, endDate: string, except?: Id<"rateOverrides">) {
  const all = await ctx.db.query("rateOverrides").withIndex("by_type_start", (q) => q.eq("roomTypeId", roomTypeId)).collect();
  const clash = all.find((o) => o._id !== except && o.startDate <= endDate && o.endDate >= startDate);
  if (clash) {
    throw appError(
      "CONFLICT",
      `Overlaps "${clash.label}" (${formatDateShort(clash.startDate)} – ${formatDateShort(clash.endDate)}). Change one of the ranges.`,
      "startDate",
    );
  }
}

function validateOverride(a: { startDate: string; endDate: string; rate: number; label: string }) {
  if (!isDateString(a.startDate) || !isDateString(a.endDate)) throw appError("INVALID_DATES", "Choose the first and last night.");
  if (a.endDate < a.startDate) throw appError("INVALID_DATES", "The last night can't be before the first.", "endDate");
  if (a.endDate > addDays(a.startDate, 366)) throw appError("INVALID_DATES", "Keep a special rate to a year or less.", "endDate");
  assertKoboAmount(a.rate, "rate", "rate");
  const label = a.label.trim();
  if (!label || label.length > 60) throw appError("INVALID_INPUT", "Name this rate, e.g. Festive season.", "label");
  return label;
}

const overrideArgs = { startDate: v.string(), endDate: v.string(), rate: v.number(), label: v.string() };

export const createOverride = mutation({
  args: { roomTypeId: v.id("roomTypes"), ...overrideArgs },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const t = await ctx.db.get(args.roomTypeId);
    if (!t) throw appError("NOT_FOUND", "That room type doesn't exist.");
    const label = validateOverride(args);
    if (args.endDate < todayLagos()) throw appError("INVALID_DATES", "That range is already over.", "endDate");
    await assertNoOverlap(ctx, t._id, args.startDate, args.endDate);
    const id = await ctx.db.insert("rateOverrides", { ...args, label });
    await audit(ctx, me, "rate.create", "rateOverrides", id, `${t.name}: ${label} ${naira(args.rate)} (${args.startDate} – ${args.endDate})`);
    await revalidate(ctx, roomTags(t.slug));
    return id;
  },
});

export const updateOverride = mutation({
  args: { id: v.id("rateOverrides"), ...overrideArgs },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const o = await ctx.db.get(args.id);
    if (!o) throw appError("NOT_FOUND", "That rate doesn't exist.");
    const label = validateOverride(args);
    await assertNoOverlap(ctx, o.roomTypeId, args.startDate, args.endDate, o._id);
    await ctx.db.patch(o._id, { startDate: args.startDate, endDate: args.endDate, rate: args.rate, label });
    const t = await ctx.db.get(o.roomTypeId);
    await audit(ctx, me, "rate.update", "rateOverrides", o._id, `${t?.name}: ${label} ${naira(args.rate)}`);
    await revalidate(ctx, roomTags(t?.slug));
  },
});

export const removeOverride = mutation({
  args: { id: v.id("rateOverrides") },
  handler: async (ctx, { id }) => {
    const me = await requireAdmin(ctx);
    const o = await ctx.db.get(id);
    if (!o) return;
    await ctx.db.delete(id);
    const t = await ctx.db.get(o.roomTypeId);
    await audit(ctx, me, "rate.remove", "rateOverrides", id, `${t?.name}: ${o.label}`);
    await revalidate(ctx, roomTags(t?.slug));
  },
});

// ─── Room units ──────────────────────────────────────────────────────────────

/** Physical rooms (staff need these for bookings and the grid). */
export const listUnits = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const types = new Map((await ctx.db.query("roomTypes").collect()).map((t) => [t._id, t]));
    const rooms = await ctx.db.query("rooms").collect();
    return rooms
      .map((r) => ({
        id: r._id,
        number: r.number,
        floor: r.floor ?? null,
        status: r.status,
        notes: r.notes ?? null,
        roomTypeId: r.roomTypeId,
        typeName: types.get(r.roomTypeId)?.name ?? "?",
        typeOrder: types.get(r.roomTypeId)?.sortOrder ?? 99,
      }))
      .sort((a, b) => a.typeOrder - b.typeOrder || a.number.localeCompare(b.number, "en", { numeric: true }));
  },
});

/** Future bookings in a room (tonight onwards). */
async function futureBookings(ctx: QueryCtx, roomId: Id<"rooms">) {
  const today = todayLagos();
  const rows = await ctx.db.query("occupancy").withIndex("by_room_date", (q) => q.eq("roomId", roomId).gte("date", today)).collect();
  const ids = [...new Set(rows.map((r) => r.bookingId).filter((x): x is Id<"bookings"> => !!x))];
  const bookings = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return bookings.filter((b): b is Doc<"bookings"> => !!b);
}

export const unitBookings = query({
  args: { id: v.id("rooms") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return (await futureBookings(ctx, id)).map((b) => ({ id: b._id, ref: b.ref, checkIn: b.checkIn, checkOut: b.checkOut, guest: `${b.guest.firstName} ${b.guest.lastName}` }));
  },
});

const unitNumber = (n: string) => {
  const number = n.trim();
  if (!number || number.length > 10) throw appError("INVALID_INPUT", "Enter the room number.", "number");
  return number;
};

export const createUnit = mutation({
  args: { number: v.string(), roomTypeId: v.id("roomTypes"), floor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const number = unitNumber(args.number);
    if (await ctx.db.query("rooms").withIndex("by_number", (q) => q.eq("number", number)).first()) {
      throw appError("CONFLICT", `Room ${number} already exists.`, "number");
    }
    if (!(await ctx.db.get(args.roomTypeId))) throw appError("NOT_FOUND", "Choose a room type.", "roomTypeId");
    const id = await ctx.db.insert("rooms", { number, roomTypeId: args.roomTypeId, floor: args.floor?.trim() || undefined, status: "active" });
    await audit(ctx, me, "room.create", "rooms", id, `Room ${number}`);
    await revalidate(ctx, ["settings", "rooms"]);
    return id;
  },
});

export const updateUnit = mutation({
  args: { id: v.id("rooms"), number: v.string(), roomTypeId: v.id("roomTypes"), floor: v.optional(v.string()), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const r = await ctx.db.get(args.id);
    if (!r) throw appError("NOT_FOUND", "That room doesn't exist.");
    const number = unitNumber(args.number);
    const same = await ctx.db.query("rooms").withIndex("by_number", (q) => q.eq("number", number)).first();
    if (same && same._id !== r._id) throw appError("CONFLICT", `Room ${number} already exists.`, "number");
    if (args.roomTypeId !== r.roomTypeId) {
      const future = await futureBookings(ctx, r._id);
      if (future.length) {
        throw appError("CONFLICT", `Move these bookings to another room before changing the type: ${future.map((b) => b.ref).join(", ")}.`, "roomTypeId");
      }
    }
    await ctx.db.patch(r._id, { number, roomTypeId: args.roomTypeId, floor: args.floor?.trim() || undefined, notes: args.notes?.trim() || undefined });
    await audit(ctx, me, "room.update", "rooms", r._id, `Room ${r.number}${number !== r.number ? ` → ${number}` : ""}`);
  },
});

/**
 * Take a room out of service (or back). A room with bookings from tonight on
 * can't go out of service until they are moved (docs/06).
 */
export const setUnitStatus = mutation({
  args: { id: v.id("rooms"), status: v.union(v.literal("active"), v.literal("out_of_service")), notes: v.optional(v.string()) },
  handler: async (ctx, { id, status, notes }) => {
    const me = await requireAdmin(ctx);
    const r = await ctx.db.get(id);
    if (!r) throw appError("NOT_FOUND", "That room doesn't exist.");
    if (status === "out_of_service") {
      const future = await futureBookings(ctx, id);
      if (future.length) {
        throw appError("CONFLICT", `Room ${r.number} has bookings to move first: ${future.map((b) => `${b.ref} (${formatDateShort(b.checkIn)})`).join(", ")}.`);
      }
    }
    await ctx.db.patch(id, { status, notes: notes?.trim() || (status === "active" ? undefined : r.notes) });
    await audit(ctx, me, "room.status", "rooms", id, `Room ${r.number} ${status === "active" ? "back in service" : "out of service"}${notes ? `: ${notes}` : ""}`);
    await revalidate(ctx, ["settings", "rooms"]);
  },
});
