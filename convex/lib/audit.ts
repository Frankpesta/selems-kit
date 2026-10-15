import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Staff } from "./auth";

// Every staff write leaves a trail (docs/06 "Audit and safety").

export async function audit(
  ctx: MutationCtx,
  me: Staff,
  action: string,
  entity: string,
  entityId: string,
  summary: string,
) {
  await ctx.db.insert("auditLog", { actor: me.userId, action, entity, entityId, summary, at: Date.now() });
}

/** Schedules a refresh of the public pages that show this data (docs/03 "Rendering and caching"). */
export async function revalidate(ctx: MutationCtx, tags: string[]) {
  const unique = [...new Set(tags)].filter(Boolean);
  if (unique.length === 0) return;
  await ctx.scheduler.runAfter(0, internal.revalidate.run, { tags: unique });
}

/** Tags for every public page (settings changes touch the NAP on every page). */
export const ALL_TAGS = [
  "settings",
  "rooms",
  "offers",
  "faqs",
  "facilities",
  "gallery",
  "reviews",
  ...["home", "rooms", "dining", "facilities", "gallery", "contact", "akure-guide", "privacy", "terms"].map(
    (k) => `content:${k}`,
  ),
];
