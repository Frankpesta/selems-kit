// Signed preview tokens for unpublished page edits (docs/06 "Preview").
// Token: "<pageKey>.<expiresAtMs>.<hmacHex>", HMAC-SHA256 over "preview:<key>.<exp>"
// with REVALIDATE_SECRET (already shared by Convex and the Next.js app). The
// Next.js /api/preview route checks it, then pages ask Convex for the draft,
// which checks it again.

export const PREVIEW_TTL_MS = 30 * 60_000;

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function sign(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

export async function createPreviewToken(secret: string, pageKey: string, now: number) {
  const exp = now + PREVIEW_TTL_MS;
  return `${pageKey}.${exp}.${await sign(secret, `preview:${pageKey}.${exp}`)}`;
}

/** The page key the token grants, or null if it is invalid or expired. */
export async function verifyPreviewToken(secret: string, token: string, now: number): Promise<string | null> {
  const m = /^([a-z0-9-]{1,40})\.(\d{10,16})\.([0-9a-f]{64})$/.exec(token);
  if (!m) return null;
  const [, key, exp, sig] = m;
  if (Number(exp) < now) return null;
  const expected = await sign(secret, `preview:${key}.${exp}`);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? key : null;
}
