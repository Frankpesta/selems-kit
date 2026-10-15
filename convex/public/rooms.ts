import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { resolveImage } from "../lib/images";
import { stripUnconfirmed } from "../lib/content";

// Public room data (docs/04 "Public functions"). Only published room types.

const fromRate = (rt: Doc<"roomTypes">) =>
  rt.weekendRate != null ? Math.min(rt.baseRate, rt.weekendRate) : rt.baseRate;

async function card(ctx: QueryCtx, rt: Doc<"roomTypes">) {
  return {
    slug: rt.slug,
    name: rt.name,
    category: rt.category,
    featured: rt.featured,
    shortDescription: rt.shortDescription,
    facts: rt.facts,
    maxAdults: rt.maxAdults,
    maxChildren: rt.maxChildren,
    sizeSqm: rt.sizeSqm ?? null,
    hasLounge: rt.facts.some((f) => /lounge/i.test(f)),
    baseRate: rt.baseRate,
    weekendRate: rt.weekendRate ?? null,
    fromRate: fromRate(rt),
    cover: await resolveImage(ctx, rt.images[0]),
    updatedAt: rt.updatedAt,
  };
}

async function publishedTypes(ctx: QueryCtx) {
  const all = await ctx.db.query("roomTypes").withIndex("by_sort").collect();
  return all.filter((r) => r.published);
}

/** Published room types in the hotel's order, for cards, the compare table and the sitemap. */
export const list = query({
  args: {},
  handler: async (ctx) => Promise.all((await publishedTypes(ctx)).map((rt) => card(ctx, rt))),
});

/**
 * One room type for its page. An old slug (after a rename) returns
 * `{ redirectTo }` so the page can 308 to the new URL.
 */
export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const all = await publishedTypes(ctx);
    const rt = all.find((r) => r.slug === slug);
    if (!rt) {
      const renamed = all.find((r) => r.slugRedirects?.includes(slug));
      return renamed ? { redirectTo: renamed.slug } : null;
    }
    const images = (await Promise.all(rt.images.map((img) => resolveImage(ctx, img)))).filter(
      (i): i is NonNullable<typeof i> => i !== null,
    );
    const others = all
      .filter((r) => r._id !== rt._id)
      .sort((a, b) => Number(b.category === rt.category) - Number(a.category === rt.category) || a.sortOrder - b.sortOrder)
      .slice(0, 3);
    return {
      room: {
        ...(await card(ctx, rt)),
        description: stripUnconfirmed(rt.description),
        amenities: rt.amenities,
        images,
        seoTitle: rt.seoTitle ?? null,
        seoDescription: rt.seoDescription ?? null,
      },
      others: await Promise.all(others.map((r) => card(ctx, r))),
    };
  },
});
