import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { createAccount } from "@convex-dev/auth/server";
import { passwordProblem } from "./lib/passwords";
import { currentStaff } from "./lib/auth";
import { isValidEmail, normaliseEmail } from "./lib/validators";
import { appError } from "./lib/errors";

const INVITE_DAYS = 7;

/**
 * Creates an admin invite for the first admin. Run from the CLI:
 *   npx convex run users:bootstrapAdmin '{"email":"…","name":"…"}'
 * That person then signs up at /admin/login?mode=signup.
 */
export const bootstrapAdmin = internalMutation({
  args: { email: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const email = normaliseEmail(args.email);
    if (!isValidEmail(email)) throw appError("INVALID_INPUT", "Enter a valid email address.", "email");

    const profile = await ctx.db
      .query("staffProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (profile) return { status: "already_staff" as const, role: profile.role };

    const now = Date.now();
    const expiresAt = now + INVITE_DAYS * 86_400_000;
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const open = invites.find((i) => i.usedAt === undefined && i.expiresAt > now);
    if (open) {
      await ctx.db.patch(open._id, { role: "admin", expiresAt, name: args.name ?? open.name });
      return { status: "invite_renewed" as const, expiresAt };
    }
    await ctx.db.insert("invites", { email, name: args.name, role: "admin", expiresAt });
    return { status: "invite_created" as const, expiresAt };
  },
});

/** The signed-in staff member, or null. Used by the admin shell. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const staff = await currentStaff(ctx);
    if (!staff) return null;
    return { name: staff.name, email: staff.email, role: staff.role };
  },
});

/** Called by the admin after a successful sign-in (Staff list shows "last sign-in"). */
export const recordSignIn = mutation({
  args: {},
  handler: async (ctx) => {
    const staff = await currentStaff(ctx);
    if (staff) await ctx.db.patch(staff._id, { lastSignInAt: Date.now() });
  },
});

/**
 * Creates a ready-to-use admin account with a password, for setting up a
 * deployment without the email code step. CLI only:
 *   npx convex run users:seedAdmin '{"email":"…","password":"…","name":"…"}'
 * The password must meet the staff policy. Prefer bootstrapAdmin + sign-up
 * once email is configured.
 */
export const seedAdmin = internalAction({
  args: { email: v.string(), password: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ status: "created" | "already_exists" }> => {
    const email = normaliseEmail(args.email);
    const problem = passwordProblem(args.password);
    if (problem) throw appError("INVALID_INPUT", problem, "password");
    const existing = await ctx.runQuery(internal.users.accountExists, { email });
    if (existing) return { status: "already_exists" };
    // The invite is what turns the new user into an admin (auth.ts → claimInvite).
    await ctx.runMutation(internal.users.bootstrapAdmin, { email, name: args.name });
    const { account } = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: { email, ...(args.name ? { name: args.name } : {}) },
      shouldLinkViaEmail: true,
    });
    await ctx.runMutation(internal.users.markEmailVerified, { accountId: account._id, email });
    return { status: "created" };
  },
});

export const accountExists = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) =>
    !!(await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", email))
      .unique()),
});

export const markEmailVerified = internalMutation({
  args: { accountId: v.id("authAccounts"), email: v.string() },
  handler: async (ctx, { accountId, email }) => {
    await ctx.db.patch(accountId, { emailVerified: email });
  },
});
