import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { audit, revalidate } from "../lib/audit";
import { appError } from "../lib/errors";
import { assertNoPlaceholder, requiredText } from "../lib/adminValidators";

// FAQs (docs/06): sortable, publishable, each shown on chosen pages.

export const FAQ_PAGES = ["home", "rooms", "dining", "contact", "akure-guide"] as const;

const tagsFor = (pages: string[]) => ["faqs", ...pages.map((p) => `content:${p}`)];

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("faqs").collect()).sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

const faqArgs = { question: v.string(), answer: v.string(), pages: v.array(v.string()), published: v.boolean() };

function clean(a: { question: string; answer: string; pages: string[]; published: boolean }) {
  const question = requiredText(a.question, "question", "the question", 200);
  const answer = requiredText(a.answer, "answer", "the answer", 2000);
  const pages = [...new Set(a.pages)].filter((p) => (FAQ_PAGES as readonly string[]).includes(p));
  if (a.published) {
    assertNoPlaceholder(question, "question", "The question");
    assertNoPlaceholder(answer, "answer", "The answer");
    if (pages.length === 0) throw appError("INVALID_INPUT", "Choose at least one page to show this on.", "pages");
  }
  return { question, answer, pages, published: a.published };
}

export const create = mutation({
  args: faqArgs,
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const data = clean(args);
    const last = (await ctx.db.query("faqs").collect()).reduce((m, f) => Math.max(m, f.sortOrder), 0);
    const id = await ctx.db.insert("faqs", { ...data, sortOrder: last + 1 });
    await audit(ctx, me, "faq.create", "faqs", id, data.question);
    await revalidate(ctx, tagsFor(data.pages));
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("faqs"), ...faqArgs },
  handler: async (ctx, { id, ...args }) => {
    const me = await requireAdmin(ctx);
    const f = await ctx.db.get(id);
    if (!f) throw appError("NOT_FOUND", "That question doesn't exist.");
    const data = clean(args);
    await ctx.db.patch(id, data);
    await audit(ctx, me, "faq.update", "faqs", id, data.question);
    await revalidate(ctx, tagsFor([...f.pages, ...data.pages]));
  },
});

export const remove = mutation({
  args: { id: v.id("faqs") },
  handler: async (ctx, { id }) => {
    const me = await requireAdmin(ctx);
    const f = await ctx.db.get(id);
    if (!f) return;
    await ctx.db.delete(id);
    await audit(ctx, me, "faq.remove", "faqs", id, f.question);
    await revalidate(ctx, tagsFor(f.pages));
  },
});

export const reorder = mutation({
  args: { ids: v.array(v.id("faqs")) },
  handler: async (ctx, { ids }) => {
    const me = await requireAdmin(ctx);
    for (const [i, id] of ids.entries()) await ctx.db.patch(id, { sortOrder: i + 1 });
    await audit(ctx, me, "faq.reorder", "faqs", "all", "FAQ order changed");
    await revalidate(ctx, tagsFor([...FAQ_PAGES]));
  },
});
