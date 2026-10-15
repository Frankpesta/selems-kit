import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { audit, revalidate } from "../lib/audit";
import { appError } from "../lib/errors";
import { imageUrl } from "../lib/images";
import { assertImagesHaveAlt, assertNoPlaceholder, cleanImages, optionalText, requiredText } from "../lib/adminValidators";
import { image } from "../schema";

// Facilities (docs/06): sortable list with publish toggles.

const TAGS = ["facilities", "content:facilities", "content:home"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = (await ctx.db.query("facilities").collect()).sort((a, b) => a.sortOrder - b.sortOrder);
    return Promise.all(all.map(async (f) => ({ ...f, imageUrl: f.image ? await imageUrl(ctx, f.image) : null })));
  },
});

const args = {
  title: v.string(),
  body: v.string(),
  icon: v.string(),
  eyebrow: v.optional(v.string()),
  image: v.optional(image),
  published: v.boolean(),
};

function clean(a: { title: string; body: string; icon: string; eyebrow?: string; image?: (typeof image)["type"]; published: boolean }) {
  const title = requiredText(a.title, "title", "a title", 80);
  const body = requiredText(a.body, "body", "a description", 1000);
  const eyebrow = optionalText(a.eyebrow, "eyebrow", "the label", 40);
  const icon = a.icon.trim() || "check";
  const img = a.image ? cleanImages([a.image])[0] : undefined;
  if (a.published) {
    if (img) assertImagesHaveAlt([img]);
    assertNoPlaceholder(title, "title", "The title");
    assertNoPlaceholder(body, "body", "The description");
  }
  return { title, body, eyebrow, icon, image: img, published: a.published };
}

export const create = mutation({
  args,
  handler: async (ctx, a) => {
    const me = await requireAdmin(ctx);
    const data = clean(a);
    const last = (await ctx.db.query("facilities").collect()).reduce((m, f) => Math.max(m, f.sortOrder), 0);
    const id = await ctx.db.insert("facilities", { ...data, sortOrder: last + 1 });
    await audit(ctx, me, "facility.create", "facilities", id, data.title);
    await revalidate(ctx, TAGS);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("facilities"), ...args },
  handler: async (ctx, { id, ...a }) => {
    const me = await requireAdmin(ctx);
    const f = await ctx.db.get(id);
    if (!f) throw appError("NOT_FOUND", "That facility doesn't exist.");
    const data = clean(a);
    await ctx.db.replace(id, { ...data, sortOrder: f.sortOrder });
    await audit(ctx, me, "facility.update", "facilities", id, data.title);
    await revalidate(ctx, TAGS);
  },
});

export const remove = mutation({
  args: { id: v.id("facilities") },
  handler: async (ctx, { id }) => {
    const me = await requireAdmin(ctx);
    const f = await ctx.db.get(id);
    if (!f) return;
    await ctx.db.delete(id);
    await audit(ctx, me, "facility.remove", "facilities", id, f.title);
    await revalidate(ctx, TAGS);
  },
});

export const reorder = mutation({
  args: { ids: v.array(v.id("facilities")) },
  handler: async (ctx, { ids }) => {
    const me = await requireAdmin(ctx);
    for (const [i, id] of ids.entries()) await ctx.db.patch(id, { sortOrder: i + 1 });
    await audit(ctx, me, "facility.reorder", "facilities", "all", "Facility order changed");
    await revalidate(ctx, TAGS);
  },
});
