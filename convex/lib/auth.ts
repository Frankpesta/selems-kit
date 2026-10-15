import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { appError } from "./errors";

// Authorization helpers. Every staff function starts with one of these (docs/04).

export type Staff = Doc<"staffProfiles">;

/** Signed-in, active staff member (either role). Throws UNAUTHENTICATED / FORBIDDEN. */
export async function requireStaff(ctx: QueryCtx | MutationCtx): Promise<Staff> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw appError("UNAUTHENTICATED", "Please sign in.");
  const profile = await ctx.db
    .query("staffProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!profile || !profile.active) {
    throw appError("FORBIDDEN", "Your account doesn't have access. Ask the hotel admin.");
  }
  return profile;
}

/** Signed-in, active admin. Throws FORBIDDEN for staff. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Staff> {
  const profile = await requireStaff(ctx);
  if (profile.role !== "admin") throw appError("FORBIDDEN", "Only an admin can do this.");
  return profile;
}

/** The current staff profile, or null (for UI queries that render a signed-out state). */
export async function currentStaff(ctx: QueryCtx | MutationCtx): Promise<Staff | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const profile = await ctx.db
    .query("staffProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return profile?.active ? profile : null;
}
