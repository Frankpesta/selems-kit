import { v } from "convex/values";
import { query } from "../_generated/server";
import { todayLagos } from "../../lib/dates";
import { resolveImage } from "../lib/images";
import { stripUnconfirmed } from "../lib/content";
import { getSettings } from "../lib/stays";
import { galleryCategory } from "../schema";
import { verifyPreviewToken } from "../lib/preview";

// Public site content (docs/04). Everything passes through stripUnconfirmed so
// [CONFIRM] placeholders and unpublished blocks never reach a page.

/** Public subset of hotel settings (no internal flags, alert lists or NAP notes). */
export const settings = query({
  args: {},
  handler: async (ctx) => {
    const s = await getSettings(ctx);
    const activeRooms = (await ctx.db.query("rooms").collect()).filter((r) => r.status === "active").length;
    return stripUnconfirmed({
      hotelName: s.hotelName,
      address: s.address,
      geo: s.geo ?? null,
      phones: s.phones,
      emails: s.emails,
      checkInTime: s.checkInTime ?? null,
      checkOutTime: s.checkOutTime ?? null,
      cancellationPolicy: s.cancellationPolicy ?? null,
      freeCancellationHours: s.freeCancellationHours ?? null,
      childrenPolicy: s.childrenPolicy ?? null,
      taxNote: s.taxNote ?? null,
      noShowCutoff: s.noShowCutoff,
      autoCancelNoShows: s.autoCancelNoShows,
      maxNights: s.maxNights,
      bookingWindowDays: s.bookingWindowDays,
      socials: s.socials,
      googleBusinessUrl: s.googleBusinessUrl ?? null,
      googleReviewUrl: s.googleReviewUrl ?? null,
      mapEmbedUrl: s.mapEmbedUrl ?? null,
      activeRooms,
      updatedAt: s.updatedAt,
    });
  },
});

/** Editable copy and SEO fields for one page key. */
export const page = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const p = await ctx.db
      .query("pages")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!p) return null;
    return {
      fields: stripUnconfirmed(p.fields ?? {}) as Record<string, unknown>,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      ogImage: await resolveImage(ctx, p.ogImage),
      updatedAt: p.updatedAt,
    };
  },
});

/**
 * The saved draft of a page, for staff previewing unpublished edits. Needs a
 * signed preview token (admin "Preview" button); returns null otherwise.
 */
export const pageDraft = query({
  args: { key: v.string(), token: v.string() },
  handler: async (ctx, { key, token }) => {
    const secret = process.env.REVALIDATE_SECRET;
    if (!secret || (await verifyPreviewToken(secret, token, Date.now())) !== key) return null;
    const p = await ctx.db
      .query("pages")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!p) return null;
    const draft = p.draftFields as { fields: Record<string, unknown>; seoTitle: string; seoDescription: string } | undefined;
    return {
      fields: stripUnconfirmed(draft?.fields ?? p.fields ?? {}) as Record<string, unknown>,
      seoTitle: draft?.seoTitle ?? p.seoTitle,
      seoDescription: draft?.seoDescription ?? p.seoDescription,
      ogImage: await resolveImage(ctx, p.ogImage),
      updatedAt: p.updatedAt,
    };
  },
});

export const faqs = query({
  args: { page: v.string() },
  handler: async (ctx, { page }) => {
    const all = await ctx.db.query("faqs").collect();
    return all
      .filter((f) => f.published && f.pages.includes(page))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => stripUnconfirmed({ question: f.question, answer: f.answer }))
      .filter((f) => f.question && f.answer);
  },
});

export const facilities = query({
  args: {},
  handler: async (ctx) => {
    const all = (await ctx.db.query("facilities").collect()).filter((f) => f.published);
    all.sort((a, b) => a.sortOrder - b.sortOrder);
    return Promise.all(
      all.map(async (f) => ({
        title: f.title,
        eyebrow: f.eyebrow ?? null,
        body: f.body,
        icon: f.icon,
        image: await resolveImage(ctx, f.image),
      })),
    );
  },
});

export const gallery = query({
  args: { category: v.optional(galleryCategory) },
  handler: async (ctx, { category }) => {
    const all = (await ctx.db.query("galleryImages").collect()).filter(
      (g) => g.published && (!category || g.category === category),
    );
    all.sort((a, b) => a.sortOrder - b.sortOrder);
    const rooms = new Map((await ctx.db.query("roomTypes").collect()).map((r) => [r._id, r]));
    const items = await Promise.all(
      all.map(async (g) => {
        const room = g.roomTypeId ? rooms.get(g.roomTypeId) : undefined;
        return {
          id: g._id,
          caption: g.caption,
          category: g.category,
          room: room?.published ? { slug: room.slug, name: room.name } : null,
          image: await resolveImage(ctx, g.image),
        };
      }),
    );
    return items.filter((i): i is typeof i & { image: NonNullable<(typeof i)["image"]> } => i.image !== null);
  },
});

/** Approved, featured reviews (max 6). Never marked up as Review schema (docs/07). */
export const reviews = query({
  args: {},
  handler: async (ctx) => {
    const all = (await ctx.db.query("reviews").collect()).filter((r) => r.approved && r.featured);
    all.sort((a, b) => b.createdAt - a.createdAt);
    return all.slice(0, 6).map((r) => ({
      authorName: r.authorName,
      rating: r.rating,
      title: r.title ?? null,
      body: r.body,
      stayMonth: r.stayMonth ?? null,
      source: r.source,
    }));
  },
});

/** Published offers whose stay window hasn't ended. */
export const offers = query({
  args: { showOnHome: v.optional(v.boolean()), slug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const today = todayLagos();
    const all = (await ctx.db.query("offers").collect()).filter(
      (o) =>
        o.published &&
        o.validTo >= today &&
        (args.showOnHome === undefined || o.showOnHome === args.showOnHome) &&
        (args.slug === undefined || o.slug === args.slug),
    );
    const roomNames = new Map((await ctx.db.query("roomTypes").collect()).map((r) => [r._id, { name: r.name, slug: r.slug }]));
    return Promise.all(
      all.map(async (o) =>
        stripUnconfirmed({
          slug: o.slug,
          title: o.title,
          summary: o.summary,
          description: o.description ?? null,
          nights: o.nights,
          priceTotal: o.priceTotal,
          rooms: o.roomTypeIds.map((id) => roomNames.get(id)).filter((r): r is { name: string; slug: string } => !!r),
          arrivalWeekdays: o.arrivalWeekdays ?? [],
          validFrom: o.validFrom,
          validTo: o.validTo,
          terms: o.terms ?? null,
          image: await resolveImage(ctx, o.image),
          updatedAt: o.updatedAt ?? null,
        }),
      ),
    );
  },
});
