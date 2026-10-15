import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { audit, revalidate } from "../lib/audit";
import { appError } from "../lib/errors";
import { containsPlaceholder } from "../lib/content";
import { createPreviewToken } from "../lib/preview";
import { PAGE_SCHEMAS, pageSchema, validateFields } from "../../lib/content-schemas";

// Content & SEO (docs/06): page copy edited through forms built from
// lib/content-schemas.ts. Edits are saved as a draft, previewed, then published.

type Draft = { fields: Record<string, unknown>; seoTitle: string; seoDescription: string; savedAt: number };

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const pages = await ctx.db.query("pages").collect();
    return PAGE_SCHEMAS.map((s) => {
      const p = pages.find((x) => x.key === s.key);
      return {
        key: s.key,
        label: s.label,
        path: s.path,
        exists: !!p,
        hasDraft: !!p?.draftFields,
        placeholders: p ? containsPlaceholder(p.fields) : false,
        updatedAt: p?.updatedAt ?? null,
      };
    });
  },
});

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    if (!pageSchema(key)) return null;
    const p = await ctx.db.query("pages").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!p) return null;
    const by = p.updatedBy ? await ctx.db.query("staffProfiles").withIndex("by_user", (q) => q.eq("userId", p.updatedBy!)).unique() : null;
    return {
      key,
      fields: p.fields as Record<string, unknown>,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      draft: (p.draftFields as Draft | undefined) ?? null,
      updatedAt: p.updatedAt,
      updatedBy: by?.name ?? null,
    };
  },
});

const pageArgs = { key: v.string(), fields: v.any(), seoTitle: v.string(), seoDescription: v.string() };

function check(args: { key: string; fields: unknown; seoTitle: string; seoDescription: string }) {
  const schema = pageSchema(args.key);
  if (!schema) throw appError("NOT_FOUND", "That page doesn't exist.");
  const { value, errors } = validateFields(schema.fields, args.fields);
  if (errors.length) throw appError("INVALID_INPUT", errors[0].message, errors[0].path);
  const seoTitle = args.seoTitle.trim();
  const seoDescription = args.seoDescription.trim();
  if (!seoTitle || seoTitle.length > 70) throw appError("INVALID_INPUT", "Write a page title of up to 70 characters.", "seoTitle");
  if (!seoDescription || seoDescription.length > 200) throw appError("INVALID_INPUT", "Write a description of up to 200 characters.", "seoDescription");
  return { fields: value, seoTitle, seoDescription };
}

async function load(ctx: Parameters<typeof requireAdmin>[0], key: string) {
  const p = await ctx.db.query("pages").withIndex("by_key", (q) => q.eq("key", key)).unique();
  if (!p) throw appError("NOT_FOUND", "That page hasn't been set up. Run the seed first.");
  return p;
}

export const saveDraft = mutation({
  args: pageArgs,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const clean = check(args);
    const p = await load(ctx, args.key);
    const draft: Draft = { ...clean, savedAt: Date.now() };
    await ctx.db.patch(p._id, { draftFields: draft });
  },
});

export const publish = mutation({
  args: pageArgs,
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const clean = check(args);
    const p = await load(ctx, args.key);
    await ctx.db.patch(p._id, {
      fields: clean.fields,
      seoTitle: clean.seoTitle,
      seoDescription: clean.seoDescription,
      draftFields: undefined,
      updatedAt: Date.now(),
      updatedBy: me.userId,
    });
    await audit(ctx, me, "page.publish", "pages", p._id, `${pageSchema(args.key)!.label} page published`);
    await revalidate(ctx, [`content:${args.key}`]);
  },
});

export const discardDraft = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    const p = await load(ctx, key);
    await ctx.db.patch(p._id, { draftFields: undefined });
  },
});

/** A 30-minute signed link that shows the saved draft on the real page. */
export const previewToken = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    if (!pageSchema(key)) throw appError("NOT_FOUND", "That page doesn't exist.");
    const secret = process.env.REVALIDATE_SECRET;
    if (!secret) throw appError("CONFLICT", "Preview needs REVALIDATE_SECRET set on the Convex deployment.");
    return createPreviewToken(secret, key, Date.now());
  },
});
