import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Security audit guard (docs/08 Phase 5, CLAUDE.md rule 5). Every client-callable
// Convex function either checks staff auth, or is a reviewed public function.
// Adding a new public function means adding it below on purpose.

const ROOT = join(__dirname, "..", "convex");

/** Unauthenticated by design; each validates args, and writes are rate-limited or token-checked. */
const PUBLIC_ALLOWED = new Set([
  "public/booking:search",
  "public/booking:quote",
  "public/booking:reserve",
  "public/booking:forGuest",
  "public/booking:cancelByGuest",
  "public/content:settings",
  "public/content:page",
  "public/content:pageDraft",
  "public/content:faqs",
  "public/content:facilities",
  "public/content:gallery",
  "public/content:reviews",
  "public/content:offers",
  "public/inquiries:submit",
  "public/rooms:list",
  "public/rooms:bySlug",
  // Signed-in user helpers: return null / no-op when not staff.
  "users:me",
  "users:recordSignIn",
]);

const AUTH_CALL = /\b(requireStaff|requireAdmin|writable)\(/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "_generated" || e.name === "lib" ? [] : files(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts") ? [p] : [];
  });
}

type Fn = { id: string; kind: string; body: string };

function publicFunctions(): Fn[] {
  return files(ROOT).flatMap((file) => {
    const src = readFileSync(file, "utf8");
    const mod = relative(ROOT, file).split(sep).join("/").replace(/\.tsx?$/, "");
    const re = /export const (\w+) = (query|mutation|action)\(/g;
    const hits = [...src.matchAll(re)];
    return hits.map((m, i) => ({
      id: `${mod}:${m[1]}`,
      kind: m[2],
      body: src.slice(m.index, hits[i + 1]?.index ?? src.length),
    }));
  });
}

describe("Convex auth audit", () => {
  const fns = publicFunctions();

  it("finds the function surface", () => {
    expect(fns.length).toBeGreaterThan(50);
  });

  it("every admin function checks staff auth", () => {
    const missing = fns.filter((f) => f.id.startsWith("admin/") && !AUTH_CALL.test(f.body)).map((f) => f.id);
    expect(missing).toEqual([]);
  });

  it("every other client-callable function is on the reviewed public list", () => {
    const unreviewed = fns.filter((f) => !f.id.startsWith("admin/") && !PUBLIC_ALLOWED.has(f.id)).map((f) => `${f.id} (${f.kind})`);
    expect(unreviewed).toEqual([]);
  });

  it("public writes are rate-limited or token-checked", () => {
    const writes = fns.filter((f) => f.id.startsWith("public/") && f.kind !== "query");
    const unguarded = writes.filter((f) => !/rateLimit|limiter|token/i.test(f.body)).map((f) => f.id);
    expect(unguarded).toEqual([]);
  });

  it("public functions validate their args", () => {
    const loose = fns.filter((f) => !/^\s*args(:\s*[{\w]|,)/m.test(f.body)).map((f) => f.id);
    expect(loose).toEqual([]);
  });
});
