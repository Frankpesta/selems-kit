import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { makeFunctionReference, type GenericActionCtx, type GenericDataModel } from "convex/server";
import type { MutationCtx } from "./_generated/server";
import { normaliseEmail } from "./lib/validators";
import { passwordProblem } from "./lib/passwords";

// Staff sign-in: email + password, invite-only (docs/04 "Auth").
//
// Two one-time email codes, sent through Resend (convex/emails.tsx → authCode):
// - "verify": a new account must prove it owns the invited inbox before its
//   first session, so knowing an invited address isn't enough to claim it.
// - "reset": forgotten password.

// Referenced by name: importing the generated `internal` here would make the
// auth types depend on themselves.
const sendAuthCode = makeFunctionReference<"action", { email: string; code: string; purpose: "verify" | "reset" }>(
  "emails:authCode",
);

const CODE_MINUTES = 15;

function emailCode(purpose: "verify" | "reset") {
  return Email({
    id: `code-${purpose}`,
    maxAge: CODE_MINUTES * 60,
    async generateVerificationToken() {
      // 8 digits from a CSPRNG (auth actions run with real randomness).
      const n = new Uint32Array(1);
      crypto.getRandomValues(n);
      return String(n[0] % 100_000_000).padStart(8, "0");
    },
    // Convex Auth passes the action ctx as a second argument (Auth.js's type omits it).
    async sendVerificationRequest({ identifier, token }: { identifier: string; token: string }, ctx?: GenericActionCtx<GenericDataModel>) {
      if (!ctx) throw new Error("Convex Auth didn't pass an action context.");
      await ctx.runAction(sendAuthCode, { email: identifier, code: token, purpose });
    },
  });
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = normaliseEmail(String(params.email ?? ""));
        const profile: { email: string } & Record<string, string> = { email };
        if (typeof params.name === "string" && params.name.trim()) profile.name = params.name.trim();
        return profile;
      },
      validatePasswordRequirements(password) {
        const problem = passwordProblem(password);
        if (problem) throw new ConvexError({ code: "INVALID_INPUT", message: problem, field: "password" });
      },
      verify: emailCode("verify"),
      reset: emailCode("reset"),
    }),
  ],
  // Failed passwords or codes per email: 20 an hour (≈ 5 per 15 minutes, docs/04).
  signIn: { maxFailedAttempsPerHour: 20 },
  callbacks: {
    // Runs inside the account-creation mutation, so throwing here rolls the new
    // user back: an uninvited email never gets an account.
    async afterUserCreatedOrUpdated(genericCtx, { userId, existingUserId, profile }) {
      if (existingUserId) return; // existing account signing in
      const ctx = genericCtx as unknown as MutationCtx;
      const email = normaliseEmail(String(profile.email ?? ""));
      await claimInvite(ctx, userId, email, typeof profile.name === "string" ? profile.name : undefined);
    },
  },
});

/** Turns a valid invite into a staff profile. Throws FORBIDDEN without one. */
export async function claimInvite(
  ctx: MutationCtx,
  userId: import("./_generated/dataModel").Id<"users">,
  email: string,
  name?: string,
) {
  const now = Date.now();
  const invites = await ctx.db
    .query("invites")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
  const invite = invites.find((i) => i.usedAt === undefined && i.expiresAt > now);
  if (!invite) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "This email hasn't been invited. Ask the hotel admin.",
    });
  }
  const existing = await ctx.db
    .query("staffProfiles")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { userId, role: invite.role, active: true });
  } else {
    await ctx.db.insert("staffProfiles", {
      userId,
      name: name || invite.name || email.split("@")[0],
      email,
      role: invite.role,
      active: true,
    });
  }
  await ctx.db.patch(invite._id, { usedAt: now });
}
