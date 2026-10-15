import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";

// Audit log (docs/06 "Audit and safety"): who changed what, newest first.

export const list = query({
  args: { limit: v.optional(v.number()), entity: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const names = new Map((await ctx.db.query("staffProfiles").collect()).map((s) => [s.userId, s.name]));
    const rows = args.entity
      ? await ctx.db.query("auditLog").withIndex("by_entity", (q) => q.eq("entity", args.entity!)).order("desc").take(limit)
      : await ctx.db.query("auditLog").order("desc").take(limit);
    return rows.map((r) => ({ id: r._id, at: r.at, who: names.get(r.actor) ?? "Former staff", action: r.action, entity: r.entity, entityId: r.entityId, summary: r.summary }));
  },
});
