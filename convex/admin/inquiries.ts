import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireStaff } from "../lib/auth";
import { audit } from "../lib/audit";
import { appError } from "../lib/errors";

// Inquiries inbox (docs/06): new / replied / closed.

const status = v.union(v.literal("new"), v.literal("replied"), v.literal("closed"));

export const list = query({
  args: { status },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    return ctx.db
      .query("inquiries")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .take(200);
  },
});

export const counts = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const all = await ctx.db.query("inquiries").collect();
    return {
      new: all.filter((i) => i.status === "new").length,
      replied: all.filter((i) => i.status === "replied").length,
      closed: all.filter((i) => i.status === "closed").length,
    };
  },
});

export const get = query({
  args: { id: v.id("inquiries") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    return ctx.db.get(id);
  },
});

export const setStatus = mutation({
  args: { id: v.id("inquiries"), status },
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const i = await ctx.db.get(args.id);
    if (!i) throw appError("NOT_FOUND", "That message doesn't exist.");
    await ctx.db.patch(args.id, { status: args.status });
    await audit(ctx, me, "inquiry.status", "inquiries", args.id, `${i.name}: ${args.status}`);
  },
});

export const setNotes = mutation({
  args: { id: v.id("inquiries"), notes: v.string() },
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const i = await ctx.db.get(args.id);
    if (!i) throw appError("NOT_FOUND", "That message doesn't exist.");
    const notes = args.notes.trim();
    if (notes.length > 2000) throw appError("INVALID_INPUT", "Keep notes under 2,000 characters.", "notes");
    await ctx.db.patch(args.id, { notes: notes || undefined });
    await audit(ctx, me, "inquiry.notes", "inquiries", args.id, i.name);
  },
});
