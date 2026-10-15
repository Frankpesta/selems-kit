import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

// On-demand revalidation, called by Convex (convex/revalidate.ts) after staff
// save content, rates, offers or photos. Body: { "tags": ["rooms", "room:vip-suite"] }.

const TAG_RE = /^[a-z0-9:_-]{1,100}$/i;

function authorised(header: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request.headers.get("x-revalidate-secret"))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  let tags: unknown;
  try {
    tags = ((await request.json()) as { tags?: unknown }).tags;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 50 || !tags.every((t) => typeof t === "string" && TAG_RE.test(t))) {
    return Response.json({ ok: false, error: "tags must be 1–50 short strings" }, { status: 400 });
  }
  // expire: 0 → the next visit renders fresh data (prices must not lag).
  for (const tag of tags as string[]) revalidateTag(tag, { expire: 0 });
  return Response.json({ ok: true, revalidated: tags });
}
