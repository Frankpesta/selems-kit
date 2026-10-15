import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { addDays, isDateString, todayLagos } from "../../lib/dates";
import { requireAdmin } from "../lib/auth";
import { audit, revalidate } from "../lib/audit";
import { appError } from "../lib/errors";
import { imageUrl } from "../lib/images";
import { assertImagesHaveAlt, assertNoPlaceholder, cleanImages, isSlug, optionalText, requiredText } from "../lib/adminValidators";
import { assertKoboAmount, naira } from "../lib/staffBookings";
import { image } from "../schema";

// Offers (docs/06). An offer prices a whole stay; the booking engine applies it
// automatically when a stay qualifies and it is cheaper (docs/04).

export type OfferStatus = "hidden" | "scheduled" | "live" | "expired";

export function offerStatus(o: Pick<Doc<"offers">, "published" | "validFrom" | "validTo">, today: string): OfferStatus {
  if (!o.published) return "hidden";
  if (o.validTo < today) return "expired";
  if (o.validFrom > today) return "scheduled";
  return "live";
}

const TAGS = ["offers", "content:home", "rooms"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const today = todayLagos();
    const types = new Map((await ctx.db.query("roomTypes").collect()).map((t) => [t._id, t.name]));
    const offers = await ctx.db.query("offers").collect();
    return Promise.all(
      offers
        .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
        .map(async (o) => ({
          ...o,
          status: offerStatus(o, today),
          roomNames: o.roomTypeIds.map((id) => types.get(id) ?? "?"),
          imageUrl: o.image ? await imageUrl(ctx, o.image) : null,
        })),
    );
  },
});

const offerArgs = {
  title: v.string(),
  slug: v.string(),
  summary: v.string(),
  description: v.optional(v.string()),
  nights: v.number(),
  priceTotal: v.number(),
  roomTypeIds: v.array(v.id("roomTypes")),
  arrivalWeekdays: v.optional(v.array(v.number())),
  validFrom: v.string(),
  validTo: v.string(),
  image: v.optional(image),
  terms: v.optional(v.string()),
  showOnHome: v.boolean(),
  published: v.boolean(),
};

type OfferInput = {
  title: string;
  slug: string;
  summary: string;
  description?: string;
  nights: number;
  priceTotal: number;
  roomTypeIds: Doc<"offers">["roomTypeIds"];
  arrivalWeekdays?: number[];
  validFrom: string;
  validTo: string;
  image?: Doc<"offers">["image"];
  terms?: string;
  showOnHome: boolean;
  published: boolean;
};

function clean(a: OfferInput) {
  const title = requiredText(a.title, "title", "a title", 90);
  const slug = a.slug.trim().toLowerCase();
  if (!isSlug(slug)) throw appError("INVALID_INPUT", "Use lower-case letters, numbers and hyphens for the address.", "slug");
  const summary = requiredText(a.summary, "summary", "a summary", 240);
  const description = optionalText(a.description, "description", "the description", 3000);
  const terms = optionalText(a.terms, "terms", "the terms", 2000);
  if (!Number.isInteger(a.nights) || a.nights < 1 || a.nights > 30) throw appError("INVALID_INPUT", "Enter the number of nights (1–30).", "nights");
  assertKoboAmount(a.priceTotal, "priceTotal", "price");
  if (a.roomTypeIds.length === 0) throw appError("INVALID_INPUT", "Choose at least one room type.", "roomTypeIds");
  if (!isDateString(a.validFrom) || !isDateString(a.validTo)) throw appError("INVALID_DATES", "Choose the dates the offer runs.", "validFrom");
  if (a.validTo < a.validFrom) throw appError("INVALID_DATES", "The end date can't be before the start.", "validTo");
  if (a.validTo > addDays(a.validFrom, 731)) throw appError("INVALID_DATES", "Keep an offer to two years or less.", "validTo");
  const weekdays = a.arrivalWeekdays?.length ? [...new Set(a.arrivalWeekdays)].sort() : undefined;
  if (weekdays?.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw appError("INVALID_INPUT", "Choose valid arrival days.", "arrivalWeekdays");
  const img = a.image ? cleanImages([a.image])[0] : undefined;
  if (a.published) {
    if (img) assertImagesHaveAlt([img]);
    for (const [v, f, l] of [[title, "title", "The title"], [summary, "summary", "The summary"], [description, "description", "The description"], [terms, "terms", "The terms"]] as const) {
      assertNoPlaceholder(v, f, l);
    }
  }
  return { title, slug, summary, description, terms, nights: a.nights, priceTotal: a.priceTotal, roomTypeIds: a.roomTypeIds, arrivalWeekdays: weekdays, validFrom: a.validFrom, validTo: a.validTo, image: img, showOnHome: a.showOnHome, published: a.published };
}

export const create = mutation({
  args: offerArgs,
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const data = clean(args);
    if (await ctx.db.query("offers").withIndex("by_slug", (q) => q.eq("slug", data.slug)).first()) {
      throw appError("CONFLICT", "Another offer already uses that address.", "slug");
    }
    const id = await ctx.db.insert("offers", { ...data, updatedAt: Date.now() });
    await audit(ctx, me, "offer.create", "offers", id, `${data.title}, ${naira(data.priceTotal)}`);
    await revalidate(ctx, TAGS);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("offers"), ...offerArgs },
  handler: async (ctx, { id, ...args }) => {
    const me = await requireAdmin(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw appError("NOT_FOUND", "That offer doesn't exist.");
    const data = clean(args);
    const same = await ctx.db.query("offers").withIndex("by_slug", (q) => q.eq("slug", data.slug)).first();
    if (same && same._id !== id) throw appError("CONFLICT", "Another offer already uses that address.", "slug");
    await ctx.db.replace(id, { ...data, updatedAt: Date.now() });
    await audit(ctx, me, "offer.update", "offers", id, `${data.title}${o.published !== data.published ? (data.published ? " (published)" : " (hidden)") : ""}`);
    await revalidate(ctx, TAGS);
  },
});

export const remove = mutation({
  args: { id: v.id("offers") },
  handler: async (ctx, { id }) => {
    const me = await requireAdmin(ctx);
    const o = await ctx.db.get(id);
    if (!o) return;
    const used = await ctx.db.query("bookings").filter((q) => q.eq(q.field("offerId"), id)).first();
    if (used) throw appError("CONFLICT", "Bookings were made with this offer. Hide it instead of deleting it.");
    await ctx.db.delete(id);
    await audit(ctx, me, "offer.remove", "offers", id, o.title);
    await revalidate(ctx, TAGS);
  },
});
