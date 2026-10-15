import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { siteUrl } from "./lib/email";

// Tells the Next.js site which cached pages to refresh (docs/04 "Revalidation").
// Scheduled by every admin write to public content; retries with backoff up to
// 3 times on failure.
export const run = internalAction({
  args: { tags: v.array(v.string()), attempt: v.optional(v.number()) },
  handler: async (ctx, { tags, attempt = 0 }) => {
    const secret = process.env.REVALIDATE_SECRET;
    if (!secret) {
      console.log(`[revalidate skipped: REVALIDATE_SECRET not set] ${tags.join(", ")}`);
      return;
    }
    let ok = false;
    try {
      const res = await fetch(`${siteUrl()}/api/revalidate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-revalidate-secret": secret },
        body: JSON.stringify({ tags }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (!ok && attempt < 3) {
      await ctx.scheduler.runAfter(2 ** attempt * 5_000, internal.revalidate.run, { tags, attempt: attempt + 1 });
    }
  },
});
