# Selems Exclusive Hotel & Suites — website rebuild

You are building the new website and admin panel for **Selems Exclusive Hotel & Suites**, Atibiti Layout, Ijapo Extension, Akure, Ondo State, Nigeria. It replaces the WordPress site at https://selemsexclusivehotel.com.

The business goal is specific: rank in Google's top 3 for searches like *hotels in Akure*, *best hotels in Akure*, *places to stay in Akure*, *suites in Akure*, and turn that traffic into direct bookings. Every decision (rendering, markup, images, copy structure) is judged against that goal and against a fast, calm, international-standard guest experience.

## Read these before writing code

| File | What it decides |
|---|---|
| `docs/01-product-brief.md` | Scope, audiences, facts we know, facts still to confirm |
| `docs/02-design-system.md` | Tokens, type, components, page-by-page visual spec |
| `docs/03-architecture.md` | Stack, folder layout, routes, rendering and caching, env vars |
| `docs/04-convex-backend.md` | Schema, functions, availability and booking rules, auth, email, crons |
| `docs/05-public-site.md` | Every public page, section by section, and the booking flow |
| `docs/06-admin-panel.md` | Every admin screen, permissions, behaviours |
| `docs/07-seo-playbook.md` | Technical SEO, structured data, redirects, local SEO, content plan |
| `docs/08-build-plan.md` | Phased build order with acceptance criteria, tests, launch checklist |
| `content/seed.json` | Real content to seed Convex with (rooms, prices, facilities, FAQs, hotel details) |
| `content/images.md` | Photo manifest: file, subject, alt text, where it is used |
| `design-reference/` | Markup and CSS of the approved design screens (reference only, not runnable) |
| `public/images/` | The hotel's real photos, already renamed for SEO |

Work through `docs/08-build-plan.md` phase by phase. Finish and verify each phase's acceptance criteria before starting the next.

## Stack (decided — do not substitute)

- **Next.js** (App Router, TypeScript, React Server Components). Use the current stable major at scaffold time.
- **Tailwind CSS v4** (CSS-first `@theme` tokens) and **shadcn/ui** for primitives.
- **Convex** for database, server functions, file storage, scheduled jobs.
- **Convex Auth** (`@convex-dev/auth`, Password provider) for staff sign-in. Guests never create accounts.
- **Resend** for transactional email (via the `@convex-dev/resend` component) with **React Email** templates.
- **next/image** for every image; admin uploads stored in **Convex file storage**.
- **Vercel** for hosting the Next.js app.
- **Payments: none online.** Guests reserve now and pay at the hotel. Do not add a payment gateway.

Before using any library API, check its current docs (package README or official site). APIs for Next.js, Convex Auth and Tailwind change between majors; do not rely on memory for setup steps, file names (`middleware.ts` vs `proxy.ts`), or config shapes. Pin exact versions in `package.json`.

## Non-negotiable rules

1. **Server-render all public content.** Public pages must deliver complete HTML (headings, copy, prices, images with alt text, JSON-LD) without client JavaScript. Use Convex `preloadQuery`/`fetchQuery` in Server Components. Only live availability and forms are client components.
2. **Money is integer kobo** (`₦70,000` = `7_000_000`). Format with `Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })`. Never store floats.
3. **Dates are `YYYY-MM-DD` strings in Africa/Lagos time.** A stay covers nights `[checkIn, checkOut)`. Never use `new Date()` arithmetic on local time for business rules; use the helpers in `lib/dates.ts` (spec in docs/04).
4. **Bookings are created only inside one Convex mutation** that re-checks availability and assigns a room. Convex mutations are transactional, so this is what prevents double-booking. Never check availability in one call and insert in another.
5. **Every mutation and action checks authorization** with the helpers in `convex/lib/auth.ts`. Public functions validate all args with `v.*` validators and rate-limit by IP/email.
6. **Every `<img>` has meaningful alt text** from Convex data. The admin refuses to publish a photo without alt text.
7. **No invented facts.** Anything marked `[CONFIRM]` in `content/seed.json` renders behind a `published: false` flag or is omitted until the hotel confirms it. Never ship placeholder brackets to production.
8. **Accessibility:** semantic landmarks, one `h1` per page, labelled form controls, visible focus, 44px touch targets, WCAG AA contrast, `prefers-reduced-motion` respected.
9. **Performance budget (mobile, 4G):** LCP < 2.0 s, CLS < 0.05, INP < 200 ms, JS on public pages < 120 KB gzipped. Check with Lighthouse in CI.
10. British/Nigerian English spelling in copy ("favourites", "centre").

## Commands

```bash
pnpm dev            # next dev + convex dev (concurrently)
pnpm dev:next       # Next.js only
pnpm dev:convex     # Convex only
pnpm build
pnpm lint
pnpm typecheck      # next typegen && tsc --noEmit
pnpm test           # vitest: "unit" project (lib/, tests/) + "convex" project (convex/**/*.test.ts, edge-runtime)
pnpm e2e            # playwright against `next start` (run pnpm build first); desktop + 390px phone
npx convex run seed:all          # load content/seed.json
npx convex run users:bootstrapAdmin '{"email":"…"}'   # first admin
```

Versions in use: Next.js 16.4.1 (Cache Components on, `proxy.ts`), React 19.3, Tailwind 4.3, shadcn 4 (radix-nova), Convex 1.46, Vitest 5, Playwright 1.64. Read `AGENTS.md` and `node_modules/next/dist/docs/` before writing Next.js code. Build-time decisions are logged at the end of docs/03.

## Conventions

- Folders: see docs/03. Components in `components/site`, `components/admin`, `components/ui` (shadcn, unmodified where possible).
- Server Components by default; add `"use client"` only for interactivity.
- Convex functions: `query`/`mutation` for public API, `internalQuery`/`internalMutation`/`internalAction` for everything called by crons or other functions.
- Name things the way hotel staff talk: "reservation", "check in", "room", "rate", "hold", not "entity", "record", "SKU".
- Commit in small steps with clear messages. Keep `docs/` updated when a decision changes.
