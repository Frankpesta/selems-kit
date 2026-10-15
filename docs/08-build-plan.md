# 08 — Build plan

Work in order. Each phase ends with its acceptance criteria passing (`pnpm lint && pnpm typecheck && pnpm test`, plus the listed checks). Open a PR per phase.

## Phase 0 — Scaffold

1. `create-next-app` (TypeScript, App Router, ESLint, Tailwind, `src/`-less layout per docs/03), pnpm.
2. Tailwind v4 tokens from docs/02 in `app/globals.css`; `next/font` for Bodoni Moda + Instrument Sans.
3. `shadcn init`; add: button, input, label, select, textarea, checkbox, calendar, popover, dialog, alert-dialog, sheet, accordion, table, tabs, badge, separator, dropdown-menu, command, sonner, form, skeleton, tooltip. Map shadcn variables to tokens; add Button variants `amber`, `line`, `light`.
4. `npx convex dev`; install `@convex-dev/auth`, `@convex-dev/resend`, `@convex-dev/rate-limiter`; `ConvexClientProvider`; `convex.config.ts`.
5. Copy `public/images/*` from this kit; add `content/`.
6. Vitest, `convex-test`, Playwright, Lighthouse CI configs; GitHub Actions running lint, typecheck, unit, e2e (against `next build && next start` with a Convex preview/dev deployment).

**Accept:** app boots; `/` renders a token test page; CI green.

## Phase 1 — Data layer

1. `convex/schema.ts` exactly as docs/04 (adjust only if a library requires it; record changes in docs/04).
2. `lib/dates.ts`, `lib/money.ts`, `convex/lib/{pricing,availability,validators,refs,auth}.ts` with unit tests:
   - dates: month/year boundaries, leap day, `todayLagos` around UTC midnight.
   - pricing: base, weekend, override precedence, offer applicability (wrong nights, wrong weekday, outside window).
   - availability: overlapping/adjacent stays (checkout day = next check-in day is allowed), blocks, out-of-service rooms.
3. `convex/seed.ts` loading `content/seed.json`; `users.bootstrapAdmin`.

**Accept:** `npx convex run seed:all` twice → no duplicates; tests cover the rules above.

## Phase 2 — Booking engine

1. `public/booking.search`, `quote`, `reserve` (action) → `internal/booking.create`; `forGuest`, `cancelByGuest`.
2. Rate limiter + optional Turnstile.
3. Email templates `BookingConfirmation`, `StaffNewBooking`, `BookingCancelled`; Resend component wiring; webhooks route in `convex/http.ts`.
4. convex-test: race test (two creates, one room → one success, one `SOLD_OUT`); validation errors; guest cancel window; token check.

**Accept:** race test passes; a booking made via a test script produces an email in Resend's test mode with a working manage link.

## Phase 3 — Public site

Build pages in this order, each matching the canvas + docs/05: layout (UtilityBar, SiteHeader, SiteFooter, MobileBookBar) → Home → Rooms → Room page (with live quote card) → Booking flow → Guest booking page → Dining → Facilities → Gallery → Contact (+ inquiry) → Akure guide → Offers landing → Privacy/Terms → 404.

Then SEO infrastructure from docs/07 A1–A5: metadata builders, JSON-LD builders + tests, sitemap (with images), robots, OG images, redirects, revalidation route.

**Accept:**
- Playwright: book a room end to end on desktop and a 390px phone viewport; sold-out path; guest cancellation.
- Playwright screenshot checks: header is a single row at 1100, 1280, 1440px; menu sheet below 1100px.
- `curl` each page: H1, prices, alt text, JSON-LD in HTML.
- Lighthouse budgets met on Home, Rooms, a room page (mobile).
- Every old URL in docs/03 redirects correctly (script).

## Phase 4 — Admin panel

Order: auth (login, invite sign-up, reset, route protection, `requireStaff`/`requireAdmin`) → shell → Today → Reservations (list, detail, new booking, all actions) → Availability grid (read, then drag-to-move, then block) → Rooms & rates (types, units, special-date rates, photos with alt) → Content & SEO (page forms from `lib/content-schemas.ts`, SERP preview, health checks, draft/preview/publish, revalidation) → Offers → Gallery → FAQs/Facilities/Reviews → Inquiries → Staff → Settings → CSV export → audit log.

**Accept:**
- Staff role cannot reach admin-only pages or call admin-only functions (tests call functions directly as a staff identity → `FORBIDDEN`).
- Changing a room rate in admin updates the public room page within seconds (revalidation) and the booking quote immediately.
- Moving a booking on the calendar into an occupied room is rejected with a clear message.
- Photo without alt text cannot be published.
- Crons run in a test (`flagLateArrivals` with fake time; `preArrivalReminders` selects only tomorrow's reserved bookings).

## Phase 5 — Content, QA, launch

1. Replace every `[CONFIRM]` value with the hotel's answers (docs/01 open questions). Real room list → `rooms` table.
2. Accessibility pass: axe in Playwright on every public page and key admin screens; keyboard-only booking run.
3. Cross-device: Android Chrome on a mid-range phone over throttled 3G/4G, iPhone Safari, desktop Chrome/Edge/Firefox.
4. Security: Convex functions audited for auth checks; no PII in logs/analytics; CSP headers (`next.config.ts` headers: default-src 'self', images from self + Convex storage host, scripts from self + Turnstile + GA after consent); `X-Frame-Options: DENY` on admin.
5. Staff training: 30-minute walkthrough + a one-page "How to" (create booking, check in/out, change price, add offer, upload photos).
6. Launch:
   - [ ] Convex prod deployed, seeded, first admin created, staff invited.
   - [ ] Resend domain verified (SPF/DKIM/DMARC); test emails delivered to Gmail and Yahoo inboxes, not spam.
   - [ ] Env vars set in Vercel and Convex prod.
   - [ ] DNS TTL lowered 48h before; switch A/CNAME to Vercel; HTTPS issued; `www` → apex.
   - [ ] Redirect script passes against production.
   - [ ] GSC: sitemap submitted, key pages inspected and indexing requested.
   - [ ] GBP website and booking links updated.
   - [ ] Old WordPress kept read-only (not public) for 30 days for rollback, then archived.
7. Post-launch (weeks 1–4): watch GSC coverage and 404s (add redirects), Core Web Vitals field data, booking funnel in GA4, email bounces; weekly GBP posts; collect reviews.

## Definition of done (whole project)

A guest on a mid-range Android phone finds the site from Google, sees real photos and prices, reserves a room in under 2 minutes without paying, and gets a confirmation email; the front desk sees it instantly on the Today screen, checks the guest in, records payment, and the manager changes next weekend's VIP Suite price without calling a developer.
