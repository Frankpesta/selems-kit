import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { audit, revalidate } from "../lib/audit";
import { appError } from "../lib/errors";
import { optionalText, requiredText } from "../lib/adminValidators";

// Reviews (docs/06). Google reviews are pasted in by hand with the guest's
// permission and are never marked up as Review schema (docs/07).

export const MAX_FEATURED = 6;
const TAGS = ["reviews", "content:home"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("reviews").collect()).sort((a, b) => Number(a.approved) - Number(b.approved) || b.createdAt - a.createdAt);
  },
});

const reviewArgs = {
  source: v.union(v.literal("google"), v.literal("email"), v.literal("website")),
  authorName: v.string(),
  rating: v.number(),
  title: v.optional(v.string()),
  body: v.string(),
  stayMonth: v.optional(v.string()), // "2026-10"
};

function clean(a: { authorName: string; rating: number; title?: string; body: string; stayMonth?: string }) {
  const authorName = requiredText(a.authorName, "authorName", "the guest's first name", 40);
  if (!Number.isInteger(a.rating) || a.rating < 1 || a.rating > 5) throw appError("INVALID_INPUT", "Choose a rating from 1 to 5.", "rating");
  const stayMonth = a.stayMonth?.trim() || undefined;
  if (stayMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(stayMonth)) throw appError("INVALID_INPUT", "Choose the month of the stay.", "stayMonth");
  return {
    authorName,
    rating: a.rating,
    title: optionalText(a.title, "title", "the title", 100),
    body: requiredText(a.body, "body", "the review", 1500),
    stayMonth,
  };
}

export const create = mutation({
  args: reviewArgs,
  handler: async (ctx, a) => {
    const me = await requireAdmin(ctx);
    const id = await ctx.db.insert("reviews", { ...clean(a), source: a.source, approved: true, featured: false, createdAt: Date.now() });
    await audit(ctx, me, "review.create", "reviews", id, `${a.rating}★ from ${a.authorName}`);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("reviews"), ...reviewArgs },
  handler: async (ctx, { id, ...a }) => {
    const me = await requireAdmin(ctx);
    const r = await ctx.db.get(id);
    if (!r) throw appError("NOT_FOUND", "That review doesn't exist.");
    await ctx.db.patch(id, { ...clean(a), source: a.source });
    await audit(ctx, me, "review.update", "reviews", id, `${a.authorName}`);
    if (r.featured) await revalidate(ctx, TAGS);
  },
});

export const setState = mutation({
  args: { id: v.id("reviews"), approved: v.boolean(), featured: v.boolean() },
  handler: async (ctx, { id, approved, featured }) => {
    const me = await requireAdmin(ctx);
    const r = await ctx.db.get(id);
    if (!r) throw appError("NOT_FOUND", "That review doesn't exist.");
    if (featured && !approved) throw appError("INVALID_INPUT", "Approve a review before featuring it.");
    if (featured && !r.featured) {
      const count = (await ctx.db.query("reviews").collect()).filter((x) => x.featured).length;
      if (count >= MAX_FEATURED) throw appError("CONFLICT", `Up to ${MAX_FEATURED} reviews can be featured. Unfeature one first.`);
    }
    await ctx.db.patch(id, { approved, featured });
    await audit(ctx, me, "review.state", "reviews", id, `${r.authorName}: ${approved ? "approved" : "not approved"}${featured ? ", featured" : ""}`);
    if (featured || r.featured) await revalidate(ctx, TAGS);
  },
});

export const remove = mutation({
  args: { id: v.id("reviews") },
  handler: async (ctx, { id }) => {
    const me = await requireAdmin(ctx);
    const r = await ctx.db.get(id);
    if (!r) return;
    await ctx.db.delete(id);
    await audit(ctx, me, "review.remove", "reviews", id, r.authorName);
    if (r.featured) await revalidate(ctx, TAGS);
  },
});
