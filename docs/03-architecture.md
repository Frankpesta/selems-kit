# 03 — Architecture

## Overview

```
Browser ──► Vercel (Next.js App Router)
              │  Server Components: fetchQuery/preloadQuery → Convex (public content, SSR/ISR)
              │  Client Components: useQuery/useMutation → Convex (availability, booking, admin)
              ▼
            Convex
              ├─ database (rooms, bookings, content…)
              ├─ file storage (admin photo uploads)
              ├─ Convex Auth (staff sessions)
              ├─ Resend component (email queue, retries, webhooks)
              ├─ rate limiter component
              └─ crons (reminders, no-show flags, review requests, sitemap ping)
```

## Repository layout

```
.
├─ app/
│  ├─ (site)/
│  │  ├─ layout.tsx                  # SiteHeader, SiteFooter, MobileBookBar, Hotel JSON-LD
│  │  ├─ page.tsx                    # /
│  │  ├─ rooms/page.tsx              # /rooms
│  │  ├─ rooms/[slug]/page.tsx       # /rooms/vip-suite …
│  │  ├─ book/page.tsx               # booking flow (client island inside server shell)
│  │  ├─ booking/[ref]/page.tsx      # guest's booking page (needs ?t=token)
│  │  ├─ dining/page.tsx
│  │  ├─ facilities/page.tsx
│  │  ├─ gallery/page.tsx
│  │  ├─ contact/page.tsx
│  │  ├─ akure-guide/page.tsx
│  │  ├─ offers/[slug]/page.tsx      # optional landing per offer
│  │  ├─ privacy/page.tsx
│  │  └─ terms/page.tsx              # booking terms & cancellation policy
│  ├─ admin/
│  │  ├─ login/page.tsx
│  │  └─ (panel)/                    # requires session; AdminShell layout
│  │     ├─ layout.tsx
│  │     ├─ page.tsx                 # Today
│  │     ├─ reservations/page.tsx
│  │     ├─ reservations/[id]/page.tsx
│  │     ├─ availability/page.tsx
│  │     ├─ rooms/page.tsx  rooms/[id]/page.tsx  rooms/units/page.tsx
│  │     ├─ content/[page]/page.tsx  # home, rooms, dining, facilities, gallery, contact, akure-guide
│  │     ├─ offers/page.tsx  faqs/page.tsx  gallery/page.tsx
│  │     ├─ inquiries/page.tsx  reviews/page.tsx
│  │     ├─ staff/page.tsx           # admin only
│  │     └─ settings/page.tsx        # admin only
│  ├─ api/revalidate/route.ts        # on-demand ISR, called by Convex
│  ├─ sitemap.ts  robots.ts  manifest.ts
│  ├─ opengraph-image.tsx            # default OG; rooms have their own
│  ├─ not-found.tsx  error.tsx
│  └─ globals.css                    # Tailwind v4 + @theme tokens
├─ components/{ui,site,admin,seo}/
├─ emails/                           # React Email templates
├─ lib/
│  ├─ dates.ts                       # Lagos-date helpers (no Date arithmetic elsewhere)
│  ├─ money.ts                       # kobo ↔ naira, formatter
│  ├─ seo.ts                         # metadata builders, JSON-LD builders
│  └─ convex-server.ts               # fetchQuery wrapper with cache tags
├─ convex/
│  ├─ schema.ts  auth.ts  auth.config.ts  http.ts  crons.ts  convex.config.ts
│  ├─ lib/{auth.ts,availability.ts,pricing.ts,validators.ts,refs.ts}
│  ├─ public/{rooms.ts,content.ts,booking.ts,inquiries.ts}
│  ├─ admin/{reservations.ts,availability.ts,rooms.ts,content.ts,staff.ts,settings.ts,uploads.ts}
│  ├─ emails.ts  revalidate.ts  seed.ts  users.ts
├─ content/seed.json  content/images.md
├─ public/images/…                    # seed photos (SEO file names)
├─ e2e/ (playwright)   tests/ (vitest, convex-test)
└─ next.config.ts  proxy.ts (Next.js 16 renamed middleware to proxy)
```

## Routing, old-URL redirects

Configure permanent (308) redirects in `next.config.ts` for every URL the WordPress site exposes, so existing Google rankings and backlinks carry over:

| Old | New |
|---|---|
| `/room/` | `/rooms` |
| `/rooms/diplomatic-suite/` | `/rooms/diplomatic-suite` |
| `/rooms/business/` | `/rooms/business-room` |
| `/rooms/executive-double/` | `/rooms/executive-double` |
| `/rooms/executive-suite/` | `/rooms/executive` |
| `/rooms/royal-suite/` | `/rooms/royal-suite` |
| `/rooms/vip-suite/` | `/rooms/vip-suite` |
| `/rooms/pent-house/` | `/rooms/penthouse` |
| `/rooms/deluxe-room/` | `/rooms/deluxe-room` |
| `/rooms/standard-room/` | `/rooms/standard-room` |
| `/facilities/` | `/facilities` |
| `/gallery/` | `/gallery` |
| `/contact/` | `/contact` |
| `/reservations`, `/reservations%20`, `/reservations/` | `/book` |
| `/wp-content/uploads/:path*` | `/gallery` (or map the 19 known files to their new `/images/...` paths) |
| `/wp-admin`, `/wp-login.php` | `/admin/login` |

Set `trailingSlash: false`. Crawl the live site once more before launch (`wget --spider` or Screaming Frog) and add any URL this table misses.

## Rendering and caching

| Surface | Strategy |
|---|---|
| Public pages | Static generation with on-demand revalidation. Server Components call `fetchQuery(api.public.*)` wrapped in `unstable_cache`/`cache` tags (or the current Next.js caching primitive): tags `content:<page>`, `rooms`, `room:<slug>`, `offers`, `faqs`, `gallery`, `settings`. `generateStaticParams` for room slugs. |
| Revalidation | When an admin saves content, rates, offers or photos, the Convex mutation schedules `internal.revalidate.run` (action) which POSTs `{ tags: [...] }` to `/api/revalidate` with header `x-revalidate-secret`. The route calls `revalidateTag` for each tag. Fallback `revalidate = 3600` on every page. |
| Live availability | Client components (`useQuery(api.public.booking.searchAvailability, …)`) on `/book` and the room page booking card. Never cached. |
| Admin | Fully client-side Convex (`useQuery`), protected by Convex Auth; `noindex`. |

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel + local | Convex deployment URL |
| `CONVEX_DEPLOY_KEY` | Vercel (build) | `npx convex deploy` in build step |
| `NEXT_PUBLIC_SITE_URL` | Vercel | `https://selemsexclusivehotel.com` (canonical base) |
| `REVALIDATE_SECRET` | Vercel + Convex | Shared secret for `/api/revalidate` |
| `SITE_URL` | Convex | Same as above, for email links and revalidation calls |
| `RESEND_API_KEY` | Convex | Resend |
| `RESEND_WEBHOOK_SECRET` | Convex | Delivery/bounce webhooks |
| `EMAIL_FROM` | Convex | `Selems Hotel <bookings@selemsexclusivehotel.com>` (verify domain in Resend: SPF, DKIM, DMARC) |
| `STAFF_ALERT_EMAILS` | Convex | Comma-separated front-desk recipients (Settings → alert recipients overrides it) |
| `RESEND_TEST_MODE` | Convex | Set to `false` in production to allow delivery to real guest addresses (default: test mode on) |
| `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` | Convex | Required by Convex Auth (generate per its docs) |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Vercel / Convex | Optional bot protection. **Leave unset**: the server check exists but the public forms don't render the widget yet, so setting the secret would refuse every booking and message. |
| `EMAIL_DEV_LOG` | Convex (dev only) | `true` prints sign-in codes and invite links to the Convex logs when no Resend key is set. Never on prod. |
| `NEXT_PUBLIC_GA_ID` | Vercel | Google Analytics 4. When set, the consent banner appears; GA loads (via `@next/third-parties`) only after "Accept". |

## Deployment

- Convex: one `dev` deployment per developer, one `prod`. Vercel build command: `npx convex deploy --cmd 'pnpm build'`.
- Domain: keep `selemsexclusivehotel.com` (apex) with `www` → apex redirect. Move DNS only at launch; lower TTL 48h before.
- Email domain: verify in Resend before launch; keep any existing mailboxes' MX records intact.
- Backups: enable Convex scheduled backups (daily) and export before each schema migration.

## Decisions recorded during the build

| Date | Decision |
|---|---|
| 2026-10-15 | Scaffolded on **Next.js 16.4.1** with `cacheComponents: true` (the create-next-app default). Public data caching uses `"use cache"` + `cacheTag()`/`cacheLife()`; `/api/revalidate` calls `revalidateTag`. Route protection lives in `proxy.ts`. |
| 2026-10-15 | **Convex Auth providers are mounted in the `/admin` layout only**, not the root layout. `ConvexAuthNextjsServerProvider` reads cookies, which would make every public page dynamic and break static rendering (CLAUDE.md rule 1). Public client islands (availability, booking, forms) use a plain `ConvexProvider` inside the `(site)` layout. |
| 2026-10-15 | shadcn/ui 4 (style `radix-nova`, Radix primitives). Its `form` component is replaced by `field` (use with react-hook-form + zod). Class merging comes from shadcn's `cn` package. Radius follows `--radius`: 2px on the public site, 6px under `[data-surface="admin"]`. Button variants `amber`, `line`, `light` and sizes `cta` (48px) / `cta-sm` (40px) added. |
| 2026-10-15 | `lib/dates.ts` and `lib/money.ts` are imported by both Next.js and Convex (Convex bundles relative imports from outside `convex/`). |
| 2026-10-15 | **Public data layer**: Server Components read Convex through `lib/data.ts` (`"use cache"` + `cacheTag` + `cacheLife("hours")` fallback). `/api/revalidate` calls `revalidateTag(tag, { expire: 0 })` so the next visit after a staff save renders fresh data (prices must not lag). |
| 2026-10-15 | **JS budget**: Next 16 + React 19 framework JS alone is ~170 KB gzipped on an empty page, so the 120 KB total in CLAUDE.md cannot be met on this stack. Working budget was **app JS on top of the framework ≤ 40 KB gzipped**; the client then asked for framer-motion animation and the shadcn date picker/selects, so Home now loads ~71 KB of app JS (framer-motion ~34 KB, icons/components ~14 KB, shared ~20 KB). The shadcn Popover/Calendar/Select (~45 KB) are kept off the initial load by `LazyStayPicker` (a look-alike that swaps in the real picker on hover/focus/tap and opens the control clicked). To hold it, public client components avoid Radix: the mobile menu is a native `<dialog>`, FAQs are native `<details>` (answers stay in the HTML), and link-buttons use `buttonVariants` classes rather than the Slot-based `<Button asChild>`. The home availability bar uses native date inputs; the range calendar lives in the (noindex) booking flow. |
| 2026-10-15 | **Prerendering and the clock**: Cache Components forbids reading the time while prerendering. Server code gets the year/date from cached helpers (`getYear()`); client components read "today in Lagos" via `useTodayLagos()` (client-only snapshot). |
| 2026-10-15 | **Convex on content pages**: the room-page quote and the contact form use `ConvexHttpClient` loaded on first use (`lib/convex-http.ts`), so content pages ship no Convex code and open no websocket. Only `/book` and `/booking/[ref]` mount the live `ConvexReactClient` (real-time availability). |
| 2026-10-15 | **Fixed elements and the page transition**: `app/(site)/template.tsx` animates a transform, which makes `position: fixed` descendants position relative to it. Fixed UI inside pages (room-page bottom bar) is portalled to `<body>`; it caused CLS 0.087 before. |
| 2026-10-15 | **Fonts**: Cormorant Garamond is loaded at weight 600 only (no italic) and Instrument Sans as one variable font; earlier builds shipped 12 font files. Share images use static TTFs in `assets/fonts/`. |
| 2026-10-15 | **Accessibility and image health** are enforced by `e2e/a11y-and-images.spec.ts` (axe, WCAG 2.2 AA; every image decodes; alt present; one h1) on every public page, desktop and phone. Links inside running text are underlined (WCAG 1.4.1). |
| 2026-10-15 | **Admin auth (Stage 4)**: `proxy.ts` runs only on `/admin/*` and `/api/auth*`. It bridges Convex Auth cookies and sends signed-out visitors to `/admin/login?next=…`. "Keep me signed in" sets a `selems_keep` cookie before sign-in; the proxy then issues 30-day auth cookies, otherwise session cookies. `ConvexAuthNextjsServerProvider` sits in `app/admin/layout.tsx` inside `<Suspense>`. |
| 2026-10-15 | **Admin UI** is client-rendered (`components/admin/*`), using native inputs/selects with 44px targets plus shadcn Dialog/Sheet/Command/AlertDialog. There's no react-hook-form: forms are small and the server validates everything and returns `{code, message, field}`. |
| 2026-10-15 | **Draft preview**: Convex signs a 30-minute token (HMAC-SHA256 with `REVALIDATE_SECRET`, `convex/lib/preview.ts`). `/api/preview?token=` verifies it and turns on Next draft mode. `getPage` (inside `"use cache"`) reads `draftMode().isEnabled` and fetches `public.content.pageDraft`. `/api/preview/exit` leaves preview. |
| 2026-10-15 | **Admin pickers are shadcn**: `components/admin/pickers.tsx` has `Choice` (Select), `DateField` (Popover + Calendar, `YYYY-MM-DD` in and out, `min`/`max`, optional clear), `TimeField` (30-minute slots) and `MonthField`. The public site keeps its native/lazy controls because of its JS budget. |
| 2026-10-15 | **`dark:` is class-based** (`@custom-variant dark` in `globals.css`). Tailwind's default followed the OS colour scheme, which switched on shadcn's dark styles for visitors in dark mode on a light-only design. |
| 2026-10-16 | **Security headers (Phase 5)** in `next.config.ts`: CSP without nonces (nonces need per-request rendering, which would end static public pages; see the Next CSP guide "Without nonces"), so `script-src` keeps `'unsafe-inline'` for Next's bootstrap scripts and allow-lists only Convex, Turnstile, Google Maps (frame) and GA. Also `frame-ancestors 'none'` + `X-Frame-Options: DENY` site-wide, `nosniff`, `strict-origin-when-cross-origin`, HSTS, a restrictive `Permissions-Policy`; `X-Robots-Tag: noindex` on `/admin`. `e2e/launch-checks.spec.ts` asserts the headers and that pages run without CSP console errors. |
| 2026-10-16 | **Auth audit as a test**: `tests/auth-audit.test.ts` scans `convex/` and fails if an `admin/*` function doesn't call `requireStaff`/`requireAdmin`, if a new client-callable function appears outside the reviewed public list, if a public write isn't rate-limited or token-checked, or if a function has no `args` validator. No PII in logs: the "email skipped" logs carry ids, not names; codes/links only with `EMAIL_DEV_LOG=true`. |
| 2026-10-16 | **Analytics**: `components/site/Analytics.tsx` (both public layouts) shows a consent banner only when `NEXT_PUBLIC_GA_ID` is set; the Google tag and `@next/third-parties` are downloaded only after "Accept" (choice kept in localStorage). Events via `lib/analytics.ts` `track()`: `view_room`, `check_availability`, `begin_booking`, `booking_reserved`, `click_call`, `click_whatsapp` (delegated listener), `submit_inquiry`. No PII. |
| 2026-10-16 | **Focus visibility bug (Tailwind v4)**: `outline-none`/`outline-hidden` set `--tw-outline-style: none`, and `focus-visible:outline-2` reuses that variable, so the public form fields (`fieldControl`) had a 2px outline of style *none*, i.e. no visible focus. Fixed with an explicit `focus-visible:outline-solid`. axe doesn't detect this; `e2e/keyboard-booking.spec.ts` now does (Tab-only booking that asserts a visible indicator on every control). The booking flow also moves focus to the new step's `h1` on every step change (it was falling to `<body>` when the pressed button unmounted). |
| 2026-10-16 | **Performance checks**: the JS budget is measured as gzipped script loaded *before the load event* (`e2e/launch-checks.spec.ts`: Home 213 KB, room page 215, Rooms 237, Contact 246, /book 272 at the time of writing). Lighthouse's `resource-summary` also counts Next's post-load route prefetches (~190 KB more), so it isn't used for the budget. Lighthouse CI (`lighthouserc.json`, run locally with `pnpm dlx @lhci/cli@0.15.1 autorun`) asserts LCP ≤ 2.0 s, CLS ≤ 0.05, TBT ≤ 200 ms, accessibility and SEO ≥ 0.95, mobile, median of 3. On the development Windows laptop, simulated LCP was 4–5 s **both before and after** Phase 5 (CPU benchmark swinging 980–2360 between runs; observed LCP = FCP, the hero `h1`), so local runs aren't a verdict. PageSpeed Insights on the Vercel preview is the launch reference. Known candidate if LCP needs work: `₦` (U+20A6) is in the fonts' latin-ext range, so both latin-ext files are discovered late, after layout. |
| 2026-10-16 | **No CI pipeline**: the GitHub Actions workflow was removed at the client's request. Checks run locally before merging and deploying: `pnpm lint && pnpm typecheck && pnpm test`, `pnpm build && pnpm e2e`, `node scripts/check-redirects.mjs`, and Lighthouse via `lighthouserc.json`. Vercel still builds each push. |
