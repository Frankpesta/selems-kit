import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import schema from "./schema";
import { modules } from "../tests/convex-modules";
import { api, internal } from "./_generated/api";
import { claimInvite } from "./auth";
import { requireAdmin, requireStaff } from "./lib/auth";
import { nextRef } from "./lib/refs";
import type { Id } from "./_generated/dataModel";

const asUser = (userId: Id<"users">) => ({ subject: `${userId}|session` });

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e instanceof ConvexError ? (e.data as { code: string }).code : String(e);
  }
  return null;
}

describe("bootstrapAdmin + invite-only sign-up", () => {
  it("creates an admin invite that turns into an admin profile", async () => {
    const t = convexTest(schema, modules);
    const res = await t.mutation(internal.users.bootstrapAdmin, { email: " Owner@Selems.com ", name: "Owner" });
    expect(res.status).toBe("invite_created");
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "owner@selems.com" });
      await claimInvite(ctx, userId, "owner@selems.com");
      return userId;
    });
    const profile = await t.run((ctx) => ctx.db.query("staffProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique());
    expect(profile).toMatchObject({ email: "owner@selems.com", name: "Owner", role: "admin", active: true });
    const invite = await t.run((ctx) => ctx.db.query("invites").first());
    expect(invite?.usedAt).toBeDefined();
    expect(await t.withIdentity(asUser(userId)).query(api.users.me, {})).toEqual({ name: "Owner", email: "owner@selems.com", role: "admin" });
  });

  it("is safe to run twice and reports an existing admin", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.users.bootstrapAdmin, { email: "owner@selems.com" });
    expect((await t.mutation(internal.users.bootstrapAdmin, { email: "owner@selems.com" })).status).toBe("invite_renewed");
    expect(await t.run(async (ctx) => (await ctx.db.query("invites").collect()).length)).toBe(1);
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "owner@selems.com" });
      await claimInvite(ctx, userId, "owner@selems.com");
    });
    expect((await t.mutation(internal.users.bootstrapAdmin, { email: "owner@selems.com" })).status).toBe("already_staff");
  });

  it("rejects sign-up without an invite, with an expired invite, or reusing an invite", async () => {
    const t = convexTest(schema, modules);
    expect(await errorCode(t.run(async (ctx) => claimInvite(ctx, await ctx.db.insert("users", {}), "stranger@example.com")))).toBe("FORBIDDEN");

    await t.run((ctx) => ctx.db.insert("invites", { email: "late@selems.com", role: "staff", expiresAt: Date.now() - 1 }));
    expect(await errorCode(t.run(async (ctx) => claimInvite(ctx, await ctx.db.insert("users", {}), "late@selems.com")))).toBe("FORBIDDEN");

    await t.run((ctx) => ctx.db.insert("invites", { email: "desk@selems.com", role: "staff", expiresAt: Date.now() + 60_000 }));
    await t.run(async (ctx) => claimInvite(ctx, await ctx.db.insert("users", {}), "desk@selems.com"));
    expect(await errorCode(t.run(async (ctx) => claimInvite(ctx, await ctx.db.insert("users", {}), "desk@selems.com")))).toBe("FORBIDDEN");
  });

  it("refuses an invalid email", async () => {
    const t = convexTest(schema, modules);
    expect(await errorCode(t.mutation(internal.users.bootstrapAdmin, { email: "not-an-email" }))).toBe("INVALID_INPUT");
  });
});

describe("requireStaff / requireAdmin", () => {
  async function staffSetup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const make = async (email: string, role: "admin" | "staff", active = true) => {
        const userId = await ctx.db.insert("users", { email });
        await ctx.db.insert("staffProfiles", { userId, name: email, email, role, active });
        return userId;
      };
      return {
        admin: await make("admin@selems.com", "admin"),
        staff: await make("desk@selems.com", "staff"),
        former: await make("former@selems.com", "staff", false),
        stranger: await ctx.db.insert("users", { email: "x@example.com" }),
      };
    });
    return { t, ids };
  }

  it("lets admins do everything and staff only staff things", async () => {
    const { t, ids } = await staffSetup();
    expect((await t.withIdentity(asUser(ids.admin)).run((ctx) => requireAdmin(ctx))).role).toBe("admin");
    expect((await t.withIdentity(asUser(ids.staff)).run((ctx) => requireStaff(ctx))).role).toBe("staff");
    expect(await errorCode(t.withIdentity(asUser(ids.staff)).run((ctx) => requireAdmin(ctx)))).toBe("FORBIDDEN");
  });

  it("blocks deactivated staff, non-staff users and signed-out callers", async () => {
    const { t, ids } = await staffSetup();
    expect(await errorCode(t.withIdentity(asUser(ids.former)).run((ctx) => requireStaff(ctx)))).toBe("FORBIDDEN");
    expect(await errorCode(t.withIdentity(asUser(ids.stranger)).run((ctx) => requireStaff(ctx)))).toBe("FORBIDDEN");
    expect(await errorCode(t.run((ctx) => requireStaff(ctx)))).toBe("UNAUTHENTICATED");
    expect(await t.withIdentity(asUser(ids.former)).query(api.users.me, {})).toBeNull();
  });
});

describe("nextRef", () => {
  it("numbers bookings per Lagos year", async () => {
    const t = convexTest(schema, modules);
    const refs = await t.run(async (ctx) => [
      await nextRef(ctx, "2026-10-15"),
      await nextRef(ctx, "2026-12-31"),
      await nextRef(ctx, "2027-01-01"),
      await nextRef(ctx, "2026-11-02"),
    ]);
    expect(refs).toEqual(["SLM-26-0001", "SLM-26-0002", "SLM-27-0001", "SLM-26-0003"]);
  });
});
