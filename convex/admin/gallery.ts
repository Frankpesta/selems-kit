import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { audit, revalidate } from "../lib/audit";
import { appError } from "../lib/errors";
import { imageUrl } from "../lib/images";
import { assertImagesHaveAlt, cleanImages, requiredText } from "../lib/adminValidators";
import { galleryCategory, image } from "../schema";

// Gallery (docs/06): upload many at once, each needs caption, alt text and a
// category before it can be published.

const TAGS = ["gallery", "content:gallery", "content:home"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = (await ctx.db.query("galleryImages").collect()).sort((a, b) => a.sortOrder - b.sortOrder);
    return Promise.all(all.map(async (g) => ({ ...g, url: await imageUrl(ctx, g.image) })));
  },
});

/** Photos with alt text, for image pickers in Content & SEO. */
export const pickable = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = (await ctx.db.query("galleryImages").collect()).filter((g) => g.image.alt.trim());
    all.sort((a, b) => a.sortOrder - b.sortOrder);
    return Promise.all(all.map(async (g) => ({ id: g._id, image: g.image, caption: g.caption, url: await imageUrl(ctx, g.image) })));
  },
});

/** Adds uploaded photos as hidden drafts; staff then describe and publish them. */
export const addMany = mutation({
  args: { images: v.array(image), category: galleryCategory },
  handler: async (ctx, { images, category }) => {
    const me = await requireAdmin(ctx);
    if (images.length > 50) throw appError("INVALID_INPUT", "Upload up to 50 photos at a time.");
    const cleaned = cleanImages(images);
    let last = (await ctx.db.query("galleryImages").collect()).reduce((m, g) => Math.max(m, g.sortOrder), 0);
    const ids = [];
    for (const img of cleaned) {
      ids.push(await ctx.db.insert("galleryImages", { image: img, caption: "", category, sortOrder: ++last, published: false }));
    }
    await audit(ctx, me, "gallery.add", "galleryImages", ids[0] ?? "none", `${ids.length} photo(s) uploaded`);
    return ids;
  },
});

export const update = mutation({
  args: {
    id: v.id("galleryImages"),
    alt: v.string(),
    caption: v.string(),
    category: galleryCategory,
    roomTypeId: v.optional(v.id("roomTypes")),
    published: v.boolean(),
  },
  handler: async (ctx, a) => {
    const me = await requireAdmin(ctx);
    const g = await ctx.db.get(a.id);
    if (!g) throw appError("NOT_FOUND", "That photo doesn't exist.");
    const [img] = cleanImages([{ ...g.image, alt: a.alt }]);
    const caption = a.caption.trim().slice(0, 120);
    if (a.published) {
      assertImagesHaveAlt([img]);
      requiredText(caption, "caption", "a caption", 120);
    }
    await ctx.db.patch(a.id, { image: img, caption, category: a.category, roomTypeId: a.roomTypeId, published: a.published });
    await audit(ctx, me, "gallery.update", "galleryImages", a.id, `${caption || "Photo"}${a.published !== g.published ? (a.published ? " published" : " hidden") : ""}`);
    if (a.published || g.published) await revalidate(ctx, TAGS);
  },
});

export const remove = mutation({
  args: { id: v.id("galleryImages") },
  handler: async (ctx, { id }) => {
    const me = await requireAdmin(ctx);
    const g = await ctx.db.get(id);
    if (!g) return;
    await ctx.db.delete(id);
    // Delete the stored file unless something else still shows it.
    if (g.image.storageId) {
      const inRooms = (await ctx.db.query("roomTypes").collect()).some((t) => t.images.some((i) => i.storageId === g.image.storageId));
      if (!inRooms) await ctx.storage.delete(g.image.storageId);
    }
    await audit(ctx, me, "gallery.remove", "galleryImages", id, g.caption || "Photo");
    if (g.published) await revalidate(ctx, TAGS);
  },
});

export const reorder = mutation({
  args: { ids: v.array(v.id("galleryImages")) },
  handler: async (ctx, { ids }) => {
    const me = await requireAdmin(ctx);
    for (const [i, id] of ids.entries()) await ctx.db.patch(id, { sortOrder: i + 1 });
    await audit(ctx, me, "gallery.reorder", "galleryImages", "all", "Gallery order changed");
    await revalidate(ctx, TAGS);
  },
});
