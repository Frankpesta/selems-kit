# 10 — Launch runbook

The order to go live, with commands. Each step lists who does it. Tick each box in the launch PR. Part B of docs/07 (Google Business Profile, reviews, citations) runs alongside.

## 0. Gate: content the hotel must confirm

The site hides anything marked `[CONFIRM]` (CLAUDE.md rule 7) and `e2e/launch-checks.spec.ts` fails if any reaches a page. It still **works** without these answers, but these sections stay missing until the hotel replies (docs/01 "Open questions"):

| # | Needed from the hotel | Where it goes once confirmed |
|---|---|---|
| 1 | **Real room list**: room numbers and type for every room | Admin → Rooms & rates → Room units (replace the development units) |
| 2 | Which phone number is right (0903 155 9943 vs 0913 155 9943) and matches Google Business Profile | Admin → Settings → Phones |
| 3 | Check-in/out times, cancellation policy, children/extra-guest policy, whether rates include VAT | Admin → Settings → Policies |
| 4 | Restaurant breakfast / lunch / dinner hours, indoor and outdoor bar hours and what the outdoor bar serves | Admin → Content & SEO → Dining |
| 5 | Exact map coordinates, Google Business Profile URL, review link | Admin → Settings → Links / Hotel details |
| 6 | Distances to Akure Airport, FUTA, Oja Oba, Alagbaka secretariat | Admin → Content & SEO → Home (location) and Akure guide |
| 7 | Directions from a landmark; airlines, road times and airport pickup | Content → Contact; Akure guide "Getting to Akure" |
| 8 | Guide author name and role | Content → Akure guide |
| 9 | Real social profile URLs | Admin → Settings → Links |
| 10 | Room sizes (or leave out), spa (confirm or drop), the "2 Days / 3 Nights" offer terms | Rooms & rates; Offers |

Staff enter these in the admin after launch. No developer or redeploy is needed. **Item 1 is the only hard blocker**: online bookings are assigned to room numbers, so the real list must be in before taking live bookings.

## 1. Convex production (developer)

```bash
npx convex deploy                      # creates/updates the prod deployment
# Auth keys (follow the Convex Auth manual setup for prod: generate JWT_PRIVATE_KEY + JWKS)
npx convex env set --prod SITE_URL https://selemsexclusivehotel.com
npx convex env set --prod REVALIDATE_SECRET "<long random string, same as Vercel>"
npx convex env set --prod RESEND_API_KEY re_…
npx convex env set --prod RESEND_WEBHOOK_SECRET whsec_…
npx convex env set --prod RESEND_TEST_MODE false
npx convex env set --prod EMAIL_FROM "Selems Hotel <bookings@selemsexclusivehotel.com>"
npx convex env set --prod STAFF_ALERT_EMAILS "frontdesk@…,manager@…"
# Do NOT set TURNSTILE_SECRET_KEY yet: the server would then require a Turnstile token,
# but the public forms don't render the widget, so every booking and message would be refused.
# Rate limits (per IP, email, phone) protect the forms until the widget is built.
# Never set EMAIL_DEV_LOG on prod (it prints sign-in codes to the logs when email is off).

npx convex run --prod seed:all '{"units":false}'   # content, rooms, rates; no development room units
npx convex run --prod users:bootstrapAdmin '{"email":"manager@…","name":"…"}'
```

- [ ] Manager signs up at `/admin/login?mode=signup`, then invites staff (Admin → Staff).
- [ ] Real room units entered (gate item 1).
- [ ] Convex dashboard → Settings → Backups: daily scheduled backups on.
- [ ] Resend webhook pointed at `https://<prod>.convex.site/resend-webhook`.

## 2. Email domain (developer + whoever controls DNS)

- [ ] Resend → Domains → add `selemsexclusivehotel.com`; add the SPF, DKIM and DMARC records it lists. **Keep existing MX records** for current mailboxes.
- [ ] Send a test booking to a Gmail and a Yahoo address: lands in the inbox, not spam; manage link works.

## 3. Vercel (developer)

Environment variables (Production):

| Name | Value |
|---|---|
| `CONVEX_DEPLOY_KEY` | Prod deploy key (Convex dashboard) |
| `NEXT_PUBLIC_SITE_URL` | `https://selemsexclusivehotel.com` |
| `REVALIDATE_SECRET` | Same as Convex |
| `NEXT_PUBLIC_GA_ID` | GA4 measurement ID (banner + GA appear only when set) |

Build command: `npx convex deploy --cmd 'pnpm build'`.

- [ ] Preview deployment: `pnpm e2e` with `E2E_BASE_URL=<preview url>` passes.
- [ ] PageSpeed Insights (mobile) on the preview for `/`, `/rooms`, `/rooms/vip-suite`: LCP < 2.0 s, CLS < 0.05, INP/TBT green. (Local Windows Lighthouse is too noisy to judge; PSI is the reference.)
- [ ] `node scripts/check-redirects.mjs <preview url>` passes.

## 4. Cross-device pass (anyone, ~1 hour)

Book, then cancel, on each. Use `@example.com` emails, then `npx convex run --prod devTools:cancelTestBookings` to clean up.

- [ ] Mid-range Android phone, Chrome, network throttled to Fast 4G / 3G (Chrome DevTools remote or the phone's developer options)
- [ ] iPhone Safari
- [ ] Desktop Chrome, Edge, Firefox
- [ ] Automated equivalent: `E2E_ALL_BROWSERS=1 pnpm e2e` (after `pnpm exec playwright install webkit firefox msedge`)
- [ ] Keyboard only: Tab through a booking (also automated in `e2e/keyboard-booking.spec.ts`)

## 5. DNS switch (whoever controls DNS)

- [ ] **48 hours before**: lower the TTL on the apex A and `www` CNAME to 300 s.
- [ ] Old WordPress: put it in maintenance mode / read-only. Export its database and uploads.
- [ ] Vercel → Domains: add `selemsexclusivehotel.com` (primary) and `www` (redirect to apex).
- [ ] Switch the A / CNAME records to Vercel's values. Wait for HTTPS to be issued.
- [ ] `node scripts/check-redirects.mjs https://selemsexclusivehotel.com --www` passes.
- [ ] Make one real booking and cancel it.

## 6. Google (manager or developer)

- [ ] Search Console: verify the domain property; submit `https://selemsexclusivehotel.com/sitemap.xml`; URL Inspection → Request indexing for Home, Rooms, each room, Dining, Contact, Akure guide.
- [ ] Google Business Profile: website link = home page; booking link = `/book`; phone matches the site exactly.
- [ ] GA4: accept the cookie banner on the live site and confirm `booking_reserved` arrives in Realtime.

## 7. After launch

- Keep the old WordPress offline but restorable for 30 days, then archive it.
- Weeks 1–4: Search Console coverage and 404s (add a redirect in `next.config.ts` for any old URL that shows up), Core Web Vitals, the GA4 booking funnel, Resend bounces. Weekly Google Business Profile posts; ask happy guests for reviews (docs/07 part B).
- Staff training: 30 minutes with `docs/09-staff-guide.md` open. Have each person make, check in, and cancel a test booking.
