import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";
import { audit } from "../lib/audit";
import { appError } from "../lib/errors";
import { isValidEmail, normaliseEmail } from "../lib/validators";
import { role } from "../schema";

// Staff accounts (docs/06, admin only). Accounts are invite-only: an invite lets
// that email address sign up (and prove it owns the inbox) within 7 days.

export const INVITE_DAYS = 7;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireAdmin(ctx);
    const now = Date.now();
    const staff = await ctx.db.query("staffProfiles").collect();
    const invites = (await ctx.db.query("invites").collect()).filter((i) => i.usedAt === undefined);
    return {
      meId: me._id,
      staff: staff
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
        .map((s) => ({ id: s._id, name: s.name, email: s.email, role: s.role, active: s.active, lastSignInAt: s.lastSignInAt ?? null })),
      invites: invites
        .sort((a, b) => b.expiresAt - a.expiresAt)
        .map((i) => ({ id: i._id, email: i.email, name: i.name ?? null, role: i.role, expiresAt: i.expiresAt, expired: i.expiresAt <= now })),
    };
  },
});

export const invite = mutation({
  args: { email: v.string(), name: v.string(), role },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const email = normaliseEmail(args.email);
    if (!isValidEmail(email)) throw appError("INVALID_INPUT", "Enter a valid email address.", "email");
    const name = args.name.trim();
    if (!name || name.length > 60) throw appError("INVALID_INPUT", "Enter the person's name.", "name");
    const existing = await ctx.db.query("staffProfiles").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (existing) throw appError("CONFLICT", existing.active ? `${email} already has an account.` : `${email} has a deactivated account. Reactivate it instead.`, "email");
    const expiresAt = Date.now() + INVITE_DAYS * 86_400_000;
    const open = (await ctx.db.query("invites").withIndex("by_email", (q) => q.eq("email", email)).collect()).filter((i) => i.usedAt === undefined);
    for (const i of open) await ctx.db.delete(i._id);
    const id = await ctx.db.insert("invites", { email, name, role: args.role, invitedBy: me.userId, expiresAt });
    await audit(ctx, me, "staff.invite", "invites", id, `${name} <${email}> as ${args.role}`);
    await ctx.scheduler.runAfter(0, internal.emails.staffInvite, { inviteId: id });
    return id;
  },
});

export const resendInvite = mutation({
  args: { id: v.id("invites") },
  handler: async (ctx, { id }) => {
    const me = await requireAdmin(ctx);
    const i = await ctx.db.get(id);
    if (!i || i.usedAt !== undefined) throw appError("NOT_FOUND", "That invite has been used or removed.");
    await ctx.db.patch(id, { expiresAt: Date.now() + INVITE_DAYS * 86_400_000 });
    await audit(ctx, me, "staff.reinvite", "invites", id, i.email);
    await ctx.scheduler.runAfter(0, internal.emails.staffInvite, { inviteId: id });
  },
});

export const revokeInvite = mutation({
  args: { id: v.id("invites") },
  handler: async (ctx, { id }) => {
    const me = await requireAdmin(ctx);
    const i = await ctx.db.get(id);
    if (!i) return;
    await ctx.db.delete(id);
    await audit(ctx, me, "staff.revokeInvite", "invites", id, i.email);
  },
});

async function activeAdmins(ctx: MutationCtx) {
  return (await ctx.db.query("staffProfiles").collect()).filter((s) => s.active && s.role === "admin");
}

/** Signs a person out everywhere (their next request has no session). */
async function endSessions(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).collect();
  for (const s of sessions) {
    const tokens = await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", s._id)).collect();
    for (const t of tokens) await ctx.db.delete(t._id);
    await ctx.db.delete(s._id);
  }
}

export const setRole = mutation({
  args: { id: v.id("staffProfiles"), role },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const s = await ctx.db.get(args.id);
    if (!s) throw appError("NOT_FOUND", "That account doesn't exist.");
    if (s.role === "admin" && args.role !== "admin") {
      const admins = await activeAdmins(ctx);
      if (admins.length <= 1 && s.active) throw appError("CONFLICT", "The hotel needs at least one admin. Make someone else an admin first.");
    }
    await ctx.db.patch(args.id, { role: args.role });
    await audit(ctx, me, "staff.role", "staffProfiles", args.id, `${s.name}: ${s.role} → ${args.role}`);
  },
});

/** Deactivating blocks sign-in at once (requireStaff checks `active`) and ends open sessions. */
export const setActive = mutation({
  args: { id: v.id("staffProfiles"), active: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const s = await ctx.db.get(args.id);
    if (!s) throw appError("NOT_FOUND", "That account doesn't exist.");
    if (!args.active) {
      if (s._id === me._id) throw appError("CONFLICT", "You can't deactivate your own account.");
      if (s.role === "admin" && (await activeAdmins(ctx)).length <= 1) throw appError("CONFLICT", "You can't deactivate the last admin.");
      await endSessions(ctx, s.userId);
    }
    await ctx.db.patch(args.id, { active: args.active });
    await audit(ctx, me, args.active ? "staff.reactivate" : "staff.deactivate", "staffProfiles", args.id, s.name);
  },
});
