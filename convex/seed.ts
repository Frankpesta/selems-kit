import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import seed from "../content/seed.json";
import imageManifest from "../content/images.json";
import { assertKobo } from "../lib/money";
import { containsPlaceholder } from "./lib/content";

// Loads content/seed.json (docs/04 "Seeding").
//   npx convex run seed:all                      insert anything missing; never touches existing rows
//   npx convex run seed:all '{"overwrite":true}' also refresh existing rows from seed.json
//   npx convex run seed:all '{"units":false}'    skip the development room units
// Rows are matched by natural key (settings key, slug, room number, title,
// question, image src, page key), so running it repeatedly creates no duplicates.
// Anything containing a [CONFIRM] marker is stored unpublished (CLAUDE.md rule 7).

type Counts = { inserted: number; updated: number; unchanged: number };
type Report = Record<string, Counts>;

const manifest = imageManifest as Record<string, { alt: string; width: number; height: number }>;

/** null → undefined, so optional schema fields are simply left out. */
function clean<T extends Record<string, unknown>>(obj: T) {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val === null || k.startsWith("_")) continue;
    out[k] = val;
  }
  return out as { [K in keyof T]: Exclude<T[K], null> };
}

function seedImage(src: string, overrides?: { alt?: string; width?: number; height?: number }) {
  const known = manifest[src];
  const alt = overrides?.alt ?? known?.alt;
  const width = overrides?.width ?? known?.width;
  const height = overrides?.height ?? known?.height;
  if (!alt || !width || !height) throw new Error(`Seed image ${src} needs alt text and dimensions`);
  return { src, alt, width, height };
}

async function upsert<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  existing: Doc<T> | null,
  value: Omit<Doc<T>, "_id" | "_creationTime">,
  overwrite: boolean,
  counts: Counts,
): Promise<Id<T>> {
  if (!existing) {
    counts.inserted++;
    return (await ctx.db.insert(table, value as never)) as Id<T>;
  }
  if (overwrite) {
    await ctx.db.replace(existing._id, value as never);
    counts.updated++;
  } else {
    counts.unchanged++;
  }
  return existing._id as Id<T>;
}

const newCounts = (): Counts => ({ inserted: 0, updated: 0, unchanged: 0 });

export const all = internalMutation({
  args: { overwrite: v.optional(v.boolean()), units: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const overwrite = args.overwrite ?? false;
    const now = Date.now();
    const report: Report = {};

    // ── Settings ────────────────────────────────────────────────────────────
    report.settings = newCounts();
    const s = seed.settings;
    const settingsDoc = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "hotel"))
      .unique();
    await upsert(
      ctx,
      "settings",
      settingsDoc,
      {
        ...clean({
          hotelName: s.hotelName,
          geo: s.geo,
          checkInTime: s.checkInTime,
          checkOutTime: s.checkOutTime,
          cancellationPolicy: s.cancellationPolicy,
          freeCancellationHours: s.freeCancellationHours,
          childrenPolicy: s.childrenPolicy,
          taxNote: s.taxNote,
          googleBusinessUrl: s.googleBusinessUrl,
          googleReviewUrl: s.googleReviewUrl,
          mapEmbedUrl: s.mapEmbedUrl,
        }),
        key: "hotel",
        hotelName: s.hotelName,
        address: clean(s.address),
        phones: s.phones,
        emails: s.emails,
        noShowCutoff: s.noShowCutoff,
        autoCancelNoShows: s.autoCancelNoShows,
        maxNights: s.maxNights,
        bookingWindowDays: s.bookingWindowDays,
        socials: clean(s.socials),
        updatedAt: now,
      } as Omit<Doc<"settings">, "_id" | "_creationTime">,
      overwrite,
      report.settings,
    );

    // ── Room types ──────────────────────────────────────────────────────────
    report.roomTypes = newCounts();
    const roomTypeIds = new Map<string, Id<"roomTypes">>();
    for (const rt of seed.roomTypes) {
      assertKobo(rt.baseRate, `${rt.slug}.baseRate`);
      if (rt.weekendRate != null) assertKobo(rt.weekendRate, `${rt.slug}.weekendRate`);
      const existing = await ctx.db
        .query("roomTypes")
        .withIndex("by_slug", (q) => q.eq("slug", rt.slug))
        .unique();
      const value = {
        ...clean({ sizeSqm: rt.sizeSqm, weekendRate: rt.weekendRate }),
        name: rt.name,
        slug: rt.slug,
        category: rt.category as "room" | "suite",
        sortOrder: rt.sortOrder,
        featured: rt.featured,
        shortDescription: rt.shortDescription,
        description: rt.description,
        facts: rt.facts,
        amenities: rt.amenities,
        maxAdults: rt.maxAdults,
        maxChildren: rt.maxChildren,
        baseRate: rt.baseRate,
        images: rt.images.map((img) => seedImage(img.src, img)),
        published: !containsPlaceholder(rt),
        seoTitle: rt.seoTitle,
        seoDescription: rt.seoDescription,
        updatedAt: now,
      } as Omit<Doc<"roomTypes">, "_id" | "_creationTime">;
      if (existing?.slugRedirects) value.slugRedirects = existing.slugRedirects;
      roomTypeIds.set(rt.slug, await upsert(ctx, "roomTypes", existing, value, overwrite, report.roomTypes));
    }

    // ── Physical rooms (development placeholders until the hotel's list arrives) ──
    report.rooms = newCounts();
    if (args.units !== false) {
      for (const [slug, numbers] of Object.entries(seed.devUnits)) {
        if (slug.startsWith("_")) continue;
        const roomTypeId = roomTypeIds.get(slug);
        if (!roomTypeId) throw new Error(`devUnits refers to unknown room type ${slug}`);
        for (const number of numbers as string[]) {
          const existing = await ctx.db
            .query("rooms")
            .withIndex("by_number", (q) => q.eq("number", number))
            .unique();
          const value = existing
            ? { ...existing, roomTypeId }
            : { number, roomTypeId, floor: number.slice(0, 1), status: "active" as const };
          const { _id, _creationTime, ...fields } = value as Doc<"rooms">;
          void _id;
          void _creationTime;
          await upsert(ctx, "rooms", existing, fields, overwrite, report.rooms);
        }
      }
    }

    // ── Offers ──────────────────────────────────────────────────────────────
    report.offers = newCounts();
    for (const o of seed.offers) {
      assertKobo(o.priceTotal, `${o.slug}.priceTotal`);
      const existing = await ctx.db
        .query("offers")
        .withIndex("by_slug", (q) => q.eq("slug", o.slug))
        .unique();
      const ids = o.roomTypeSlugs.map((slug) => {
        const id = roomTypeIds.get(slug);
        if (!id) throw new Error(`Offer ${o.slug} refers to unknown room type ${slug}`);
        return id;
      });
      await upsert(
        ctx,
        "offers",
        existing,
        {
          title: o.title,
          slug: o.slug,
          summary: o.summary,
          nights: o.nights,
          priceTotal: o.priceTotal,
          roomTypeIds: ids,
          arrivalWeekdays: o.arrivalWeekdays,
          validFrom: o.validFrom,
          validTo: o.validTo,
          terms: o.terms,
          showOnHome: o.showOnHome,
          published: o.published && !containsPlaceholder(o),
          updatedAt: now,
        },
        overwrite,
        report.offers,
      );
    }

    // ── Facilities ──────────────────────────────────────────────────────────
    report.facilities = newCounts();
    for (const f of seed.facilities) {
      const existing = await ctx.db
        .query("facilities")
        .withIndex("by_title", (q) => q.eq("title", f.title))
        .unique();
      await upsert(
        ctx,
        "facilities",
        existing,
        {
          ...clean({ eyebrow: f.eyebrow }),
          title: f.title,
          body: f.body,
          icon: f.icon,
          image: f.image ? seedImage(f.image.src, f.image) : undefined,
          sortOrder: f.sortOrder,
          published: f.published && !containsPlaceholder(f),
        },
        overwrite,
        report.facilities,
      );
    }

    // ── FAQs ────────────────────────────────────────────────────────────────
    report.faqs = newCounts();
    for (const f of seed.faqs) {
      const existing = await ctx.db
        .query("faqs")
        .withIndex("by_question", (q) => q.eq("question", f.question))
        .unique();
      await upsert(
        ctx,
        "faqs",
        existing,
        {
          question: f.question,
          answer: f.answer,
          pages: f.pages,
          sortOrder: f.sortOrder,
          published: f.published && !containsPlaceholder({ q: f.question, a: f.answer }),
        },
        overwrite,
        report.faqs,
      );
    }

    // ── Gallery ─────────────────────────────────────────────────────────────
    report.galleryImages = newCounts();
    for (const [i, g] of seed.gallery.entries()) {
      const existing = await ctx.db
        .query("galleryImages")
        .withIndex("by_src", (q) => q.eq("image.src", g.src))
        .unique();
      const room = "room" in g ? (g.room as string | undefined) : undefined;
      const roomTypeId = room ? roomTypeIds.get(room) : undefined;
      if (room && !roomTypeId) throw new Error(`Gallery ${g.src} refers to unknown room type ${room}`);
      await upsert(
        ctx,
        "galleryImages",
        existing,
        {
          image: seedImage(g.src),
          caption: g.caption,
          category: g.category as Doc<"galleryImages">["category"],
          roomTypeId,
          sortOrder: i + 1,
          published: !containsPlaceholder(g),
        },
        overwrite,
        report.galleryImages,
      );
    }

    // ── Page copy ───────────────────────────────────────────────────────────
    // Stored as written (including [CONFIRM] markers, so staff see what is
    // outstanding); public queries strip unconfirmed values before rendering.
    report.pages = newCounts();
    for (const [key, page] of Object.entries(seed.pages)) {
      const existing = await ctx.db
        .query("pages")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      await upsert(
        ctx,
        "pages",
        existing,
        {
          key,
          fields: page.fields,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          updatedAt: now,
        },
        overwrite,
        report.pages,
      );
    }

    return report;
  },
});
