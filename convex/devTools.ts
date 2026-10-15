import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { releaseNights } from "./lib/bookings";

// Development helpers, callable only from the CLI / dashboard (internal).
//   npx convex run devTools:cancelTestBookings
// Cancels reserved bookings made with @example.com addresses (e2e and debug runs).
export const cancelTestBookings = internalMutation({
  args: { domain: v.optional(v.string()) },
  handler: async (ctx, { domain = "@example.com" }) => {
    const reserved = await ctx.db
      .query("bookings")
      .withIndex("by_status_checkIn", (q) => q.eq("status", "reserved"))
      .collect();
    const test = reserved.filter((b) => b.guest.email.endsWith(domain));
    for (const b of test) {
      await releaseNights(ctx, b._id);
      await ctx.db.patch(b._id, { status: "cancelled", cancelledReason: "Test booking cleanup", updatedAt: Date.now() });
    }
    return { cancelled: test.map((b) => b.ref) };
  },
});
