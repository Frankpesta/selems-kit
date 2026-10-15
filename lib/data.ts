import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { fill } from "./contact";
import { formatNaira } from "./money";

// Cached reads of public Convex data for Server Components (docs/03 "Rendering
// and caching"). Each function is tagged; when staff save something, Convex
// calls /api/revalidate with the matching tags. `cacheLife("hours")` is the
// fallback refresh if a revalidation call is ever missed.
//
// Tags: settings · rooms · room:<slug> · content:<page> · faqs · facilities ·
//       gallery · reviews · offers

export async function getSettings() {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");
  return fetchQuery(api.public.content.settings, {});
}

export async function getRooms() {
  "use cache";
  cacheLife("hours");
  cacheTag("rooms");
  return fetchQuery(api.public.rooms.list, {});
}

export async function getRoom(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("rooms", `room:${slug}`);
  return fetchQuery(api.public.rooms.bySlug, { slug });
}

export async function getPage(key: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`content:${key}`);
  // Staff previewing unpublished edits (/api/preview turned draft mode on).
  // In draft mode this function re-runs on every request and isn't cached.
  if ((await draftMode()).isEnabled && process.env.REVALIDATE_SECRET) {
    const { createPreviewToken } = await import("@/convex/lib/preview");
    const token = await createPreviewToken(process.env.REVALIDATE_SECRET, key, Date.now());
    const draft = await fetchQuery(api.public.content.pageDraft, { key, token });
    if (draft) return draft;
  }
  return fetchQuery(api.public.content.page, { key });
}

/** FAQs for a page, with {fromRate}/{toRate} filled from live room rates. */
export async function getFaqs(page: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("faqs", "rooms");
  const [faqs, rooms] = await Promise.all([
    fetchQuery(api.public.content.faqs, { page }),
    fetchQuery(api.public.rooms.list, {}),
  ]);
  const rates = rooms.flatMap((r) => [r.baseRate, r.weekendRate ?? r.baseRate]);
  const vars: Record<string, string> = rates.length
    ? { fromRate: formatNaira(Math.min(...rates)), toRate: formatNaira(Math.max(...rates)) }
    : {};
  return faqs.map((f) => ({ question: f.question, answer: fill(f.answer, vars) }));
}

export async function getFacilities() {
  "use cache";
  cacheLife("hours");
  cacheTag("facilities");
  return fetchQuery(api.public.content.facilities, {});
}

export async function getGallery() {
  "use cache";
  cacheLife("hours");
  cacheTag("gallery");
  return fetchQuery(api.public.content.gallery, {});
}

export async function getReviews() {
  "use cache";
  cacheLife("hours");
  cacheTag("reviews");
  return fetchQuery(api.public.content.reviews, {});
}

export async function getOffers(opts: { showOnHome?: boolean; slug?: string } = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag("offers");
  return fetchQuery(api.public.content.offers, opts);
}

export type SiteSettings = Awaited<ReturnType<typeof getSettings>>;
export type RoomCard = Awaited<ReturnType<typeof getRooms>>[number];

/** Current year in Lagos, cached daily (prerendering may not read the clock directly). */
export async function getYear() {
  "use cache";
  cacheLife("days");
  const { todayLagos } = await import("./dates");
  return Number(todayLagos().slice(0, 4));
}
