import type { MutationCtx } from "../_generated/server";

// Booking references and guest manage-link tokens (docs/04).

/** Next booking reference for the Lagos year of `today`: "SLM-26-0001", "SLM-26-0002", … */
export async function nextRef(ctx: MutationCtx, today: string): Promise<string> {
  const yy = today.slice(2, 4);
  const name = `booking-${yy}`;
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  const value = (counter?.value ?? 0) + 1;
  if (counter) await ctx.db.patch(counter._id, { value });
  else await ctx.db.insert("counters", { name, value });
  return formatRef(yy, value);
}

export const formatRef = (yy: string, seq: number) => `SLM-${yy}-${String(seq).padStart(4, "0")}`;

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** 32 random bytes, base64url. Only its SHA-256 hash is stored. */
export function newManageToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two hex digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
