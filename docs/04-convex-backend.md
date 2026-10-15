# 04 — Convex backend

## Principles

- All business rules live in Convex. The Next.js app renders and calls functions; it never decides availability or price.
- Public functions live in `convex/public/*`, staff functions in `convex/admin/*`, background work in `internal*` functions.
- Money in kobo (`v.int64()` is not needed; `v.number()` holding integers is fine, but assert `Number.isInteger`).
- Dates as `YYYY-MM-DD` strings (Africa/Lagos, UTC+1, no DST). Times of day as `HH:mm` strings.
- Throw `ConvexError({ code, message })` with stable codes (`SOLD_OUT`, `INVALID_DATES`, `NOT_FOUND`, `FORBIDDEN`, `RATE_LIMITED`, `CONFLICT`) so the UI can show friendly messages.

## Components (`convex/convex.config.ts`)

- `@convex-dev/resend` — email queue with retries, idempotency, webhook status.
- `@convex-dev/rate-limiter` — booking and inquiry submission limits.
- Convex Auth tables via `authTables` in the schema (not a component).

Check each package's README for current install steps before wiring.

## Schema (`convex/schema.ts`)

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const image = v.object({
  storageId: v.optional(v.id("_storage")), // admin uploads
  src: v.optional(v.string()),             // seed photos under /public/images
  alt: v.string(),                         // required, non-empty
  width: v.number(),
  height: v.number(),
});

export default defineSchema({
  ...authTables,

  staffProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("staff")),
    active: v.boolean(),
  }).index("by_user", ["userId"]).index("by_email", ["email"]),

  invites: defineTable({
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("staff")),
    invitedBy: v.optional(v.id("users")),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  settings: defineTable({            // singleton, key = "hotel"
    key: v.literal("hotel"),
    hotelName: v.string(),
    address: v.object({ street: v.string(), locality: v.string(), region: v.string(), country: v.string(), postalCode: v.optional(v.string()) }),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    phones: v.array(v.object({ label: v.string(), number: v.string(), whatsapp: v.boolean() })),
    emails: v.object({ booking: v.string(), info: v.string() }),
    checkInTime: v.optional(v.string()),   // "14:00" — unset = hide on site
    checkOutTime: v.optional(v.string()),
    noShowCutoff: v.string(),              // "20:00"
    autoCancelNoShows: v.boolean(),
    cancellationPolicy: v.optional(v.string()),
    freeCancellationHours: v.optional(v.number()), // guest self-cancel allowed until N hours before check-in
    childrenPolicy: v.optional(v.string()),
    taxNote: v.optional(v.string()),       // e.g. "Rates include VAT"
    maxNights: v.number(),                 // 30
    bookingWindowDays: v.number(),         // 365
    socials: v.object({ facebook: v.optional(v.string()), instagram: v.optional(v.string()), x: v.optional(v.string()), tiktok: v.optional(v.string()) }),
    googleBusinessUrl: v.optional(v.string()),
    googleReviewUrl: v.optional(v.string()),
    mapEmbedUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  roomTypes: defineTable({
    name: v.string(),
    slug: v.string(),
    category: v.union(v.literal("room"), v.literal("suite")),
    sortOrder: v.number(),
    shortDescription: v.string(),
    description: v.string(),
    facts: v.array(v.string()),            // ["1 bed", "1 bathroom", "Separate lounge"]
    amenities: v.array(v.string()),
    maxAdults: v.number(),
    maxChildren: v.number(),
    sizeSqm: v.optional(v.number()),
    baseRate: v.number(),                  // kobo per night
    weekendRate: v.optional(v.number()),   // kobo, applies to Friday and Saturday nights
    images: v.array(image),                // first = cover
    published: v.boolean(),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]).index("by_sort", ["sortOrder"]),

  rooms: defineTable({                     // physical rooms
    number: v.string(),                    // "301"
    roomTypeId: v.id("roomTypes"),
    floor: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("out_of_service")),
    notes: v.optional(v.string()),
  }).index("by_type", ["roomTypeId"]).index("by_number", ["number"]),

  rateOverrides: defineTable({
    roomTypeId: v.id("roomTypes"),
    startDate: v.string(),                 // first night
    endDate: v.string(),                   // last night (inclusive)
    rate: v.number(),                      // kobo
    label: v.string(),                     // "Festive season"
  }).index("by_type_start", ["roomTypeId", "startDate"]),

  occupancy: defineTable({                 // one row per room per night that is taken
    roomId: v.id("rooms"),
    date: v.string(),                      // the night
    bookingId: v.optional(v.id("bookings")),
    blockId: v.optional(v.id("blocks")),
  }).index("by_date", ["date"])
    .index("by_room_date", ["roomId", "date"])
    .index("by_booking", ["bookingId"])
    .index("by_block", ["blockId"]),

  blocks: defineTable({
    roomId: v.id("rooms"),
    startDate: v.string(), endDate: v.string(), // [start, end)
    reason: v.union(v.literal("maintenance"), v.literal("event"), v.literal("owner_use"), v.literal("other")),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_room", ["roomId"]),

  bookings: defineTable({
    ref: v.string(),                       // "SLM-26-0418"
    roomTypeId: v.id("roomTypes"),
    roomId: v.id("rooms"),
    checkIn: v.string(), checkOut: v.string(), nights: v.number(),
    adults: v.number(), children: v.number(),
    guest: v.object({ firstName: v.string(), lastName: v.string(), email: v.string(), phone: v.string() }),
    arrivalWindow: v.optional(v.string()),
    purpose: v.optional(v.union(v.literal("business"), v.literal("leisure"), v.literal("event"), v.literal("other"))),
    specialRequests: v.optional(v.string()),
    source: v.union(v.literal("website"), v.literal("phone"), v.literal("whatsapp"), v.literal("walk_in"), v.literal("email"), v.literal("other")),
    status: v.union(v.literal("reserved"), v.literal("checked_in"), v.literal("checked_out"), v.literal("cancelled"), v.literal("no_show")),
    lateArrivalFlag: v.optional(v.boolean()),
    nightly: v.array(v.object({ date: v.string(), rate: v.number(), reason: v.string() })),
    offerId: v.optional(v.id("offers")),
    amountDue: v.number(),                 // kobo
    amountPaid: v.number(),                // kobo, sum of payments
    paymentStatus: v.union(v.literal("unpaid"), v.literal("part_paid"), v.literal("paid")),
    manageTokenHash: v.string(),
    createdBy: v.optional(v.id("users")),  // undefined = website
    cancelledReason: v.optional(v.string()),
    searchText: v.string(),                // lower-cased "first last phone ref", kept in sync on every write
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_ref", ["ref"])
    .index("by_checkIn", ["checkIn"])
    .index("by_status_checkIn", ["status", "checkIn"])
    .index("by_checkOut", ["checkOut"])
    .index("by_email", ["guest.email"])
    .searchIndex("search_guest", { searchField: "searchText", filterFields: ["status"] }),

  payments: defineTable({
    bookingId: v.id("bookings"),
    amount: v.number(),
    method: v.union(v.literal("cash"), v.literal("transfer"), v.literal("pos"), v.literal("other")),
    note: v.optional(v.string()),
    receivedBy: v.id("users"),
    at: v.number(),
  }).index("by_booking", ["bookingId"]),

  bookingEvents: defineTable({
    bookingId: v.id("bookings"),
    type: v.string(),                      // created, email_sent, checked_in, moved, payment, cancelled, note…
    message: v.string(),
    by: v.optional(v.id("users")),
    at: v.number(),
  }).index("by_booking", ["bookingId"]),

  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),

  offers: defineTable({
    title: v.string(), slug: v.string(), summary: v.string(), description: v.optional(v.string()),
    nights: v.number(), priceTotal: v.number(),         // kobo for the whole stay
    roomTypeIds: v.array(v.id("roomTypes")),
    arrivalWeekdays: v.optional(v.array(v.number())),   // 0=Sun … 6=Sat; e.g. [5] for Friday arrivals
    validFrom: v.string(), validTo: v.string(),         // stay dates window
    image: v.optional(image),
    terms: v.optional(v.string()),
    showOnHome: v.boolean(),
    published: v.boolean(),
  }).index("by_slug", ["slug"]),

  pages: defineTable({                     // editable page copy, shape validated per page key (lib/content-schemas.ts)
    key: v.string(),                       // "home" | "rooms" | "dining" | "facilities" | "gallery" | "contact" | "akure-guide" | "privacy" | "terms"
    fields: v.any(),
    seoTitle: v.string(), seoDescription: v.string(),
    ogImage: v.optional(image),
    updatedAt: v.number(), updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  faqs: defineTable({
    question: v.string(), answer: v.string(),
    pages: v.array(v.string()),            // page keys where shown
    sortOrder: v.number(), published: v.boolean(),
  }),

  facilities: defineTable({
    title: v.string(), body: v.string(), icon: v.string(), eyebrow: v.optional(v.string()),
    image: v.optional(image), sortOrder: v.number(), published: v.boolean(),
  }),

  galleryImages: defineTable({
    image, caption: v.string(),
    category: v.union(v.literal("rooms"), v.literal("suites"), v.literal("dining"), v.literal("bar"), v.literal("hotel")),
    roomTypeId: v.optional(v.id("roomTypes")),
    sortOrder: v.number(), published: v.boolean(),
  }).index("by_category", ["category", "sortOrder"]),

  reviews: defineTable({
    source: v.union(v.literal("google"), v.literal("email"), v.literal("website")),
    authorName: v.string(), rating: v.number(), title: v.optional(v.string()), body: v.string(),
    stayMonth: v.optional(v.string()), bookingId: v.optional(v.id("bookings")),
    approved: v.boolean(), featured: v.boolean(), createdAt: v.number(),
  }),

  inquiries: defineTable({
    name: v.string(), email: v.string(), phone: v.optional(v.string()),
    subject: v.union(v.literal("reservation"), v.literal("group"), v.literal("request"), v.literal("suggestion"), v.literal("testimony"), v.literal("complaint")),
    message: v.string(),
    status: v.union(v.literal("new"), v.literal("replied"), v.literal("closed")),
    createdAt: v.number(),
  }).index("by_status", ["status", "createdAt"]),

  auditLog: defineTable({
    actor: v.id("users"), action: v.string(), entity: v.string(), entityId: v.string(),
    summary: v.string(), at: v.number(),
  }).index("by_entity", ["entity", "entityId"]),
});
```

Keep `bookings.searchText` (`"${first} ${last} ${phone} ${ref}"`, lower-cased) in sync on every booking write.

## Date helpers (`lib/dates.ts`, shared by Next.js and Convex via a `shared/` folder or duplicated)

Treat `YYYY-MM-DD` as a calendar date. Do arithmetic in UTC on midnight values only:

```ts
export const parse = (d: string) => { const [y, m, day] = d.split("-").map(Number); return Date.UTC(y, m - 1, day); };
export const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fmt(parse(d) + n * 86_400_000);
export const nightsBetween = (a: string, b: string) => Math.round((parse(b) - parse(a)) / 86_400_000);
export const eachNight = (a: string, b: string) => Array.from({ length: nightsBetween(a, b) }, (_, i) => addDays(a, i));
export const weekday = (d: string) => new Date(parse(d)).getUTCDay(); // 0 Sun … 6 Sat
export const todayLagos = (now = Date.now()) => fmt(now + 3_600_000 - ((now + 3_600_000) % 86_400_000));
export const nowLagosHHmm = (now = Date.now()) => new Date(now + 3_600_000).toISOString().slice(11, 16);
```

Unit-test these (month ends, leap years, `todayLagos` at 23:30 UTC).

## Pricing (`convex/lib/pricing.ts`)

```
priceStay(roomType, overrides, checkIn, checkOut, offer?) → { nightly: [{date, rate, reason}], total }
for each night:
  rate = override covering that night (rateOverrides where startDate ≤ night ≤ endDate)  → reason "label"
       ?? (weekday(night) is Fri(5) or Sat(6) && weekendRate) → reason "weekend"
       ?? baseRate → reason "standard"
if offer applies (published, roomType in offer.roomTypeIds, nights == offer.nights,
                  validFrom ≤ checkIn and addDays(checkOut,-1) ≤ validTo,
                  arrivalWeekdays empty or includes weekday(checkIn)):
  total = offer.priceTotal; spread across nights for display (last night absorbs rounding), reason "offer"
else total = Σ nightly.rate
```

## Availability (`convex/lib/availability.ts`)

```
occupiedRoomIds(ctx, nights[]) → Set<roomId>
  for each night: ctx.db.query("occupancy").withIndex("by_date", q => q.eq("date", night)) → add roomId
freeRoomsOfType(ctx, roomTypeId, checkIn, checkOut) → rooms[]
  active rooms of type (by_type, status "active") minus occupiedRoomIds(eachNight(checkIn, checkOut)), sorted by number
```

A stay of up to 30 nights is at most 30 indexed reads plus the rooms list — well within Convex limits for a hotel of this size.

## Public functions

| Function | Type | Behaviour |
|---|---|---|
| `public/rooms.list` | query | Published room types by `sortOrder`, cover image URL resolved (`ctx.storage.getUrl` or `src`), "from" rate. |
| `public/rooms.bySlug` | query | One room type with all images, amenities, policies from settings, other rooms (3, same category first). |
| `public/content.page` | query | `{fields, seo}` for a page key. |
| `public/content.settings` | query | Public subset of settings (no internal flags). |
| `public/content.offers` | query | Published offers currently valid; `showOnHome` filter arg. |
| `public/content.faqs` | query | Published FAQs for a page key. |
| `public/content.gallery` | query | Published gallery images, optional category. |
| `public/content.facilities` / `reviews` | query | Published facilities; approved+featured reviews. |
| `public/booking.search` | query | Args `{checkIn, checkOut, adults, children}`. Validates dates (see rules). Returns every published room type with `{available: number, priceNightly[], total, offer?}`; `available` capped at 5 for display ("Only 2 left" when ≤ 2). Sold-out types included with `available: 0`. |
| `public/booking.quote` | query | One room type + dates (+ optional offer slug) → price breakdown and `available`. Used by the room page card. |
| `public/booking.reserve` | action | Verifies Turnstile token (if enabled), checks rate limits (per email: 5/hour; per phone: 5/hour; global: 60/min), then `ctx.runMutation(internal.booking.create, …)`. Returns `{ref, token}`. |
| `internal/booking.create` | internalMutation | The only place a website booking is written. Steps below. |
| `public/booking.forGuest` | query | `{ref, token}` → guest-safe booking view if `sha256(token) === manageTokenHash`, else `null`. |
| `public/booking.cancelByGuest` | mutation | `{ref, token}`; allowed only while status `reserved` and before `checkIn − freeCancellationHours`. Frees occupancy, emails guest and staff. |
| `public/inquiries.submit` | action | Turnstile + rate limit (3/hour per email), inserts inquiry, emails staff. |

### Validation rules (shared `convex/lib/validators.ts`)

- `checkIn ≥ todayLagos()`; `checkOut > checkIn`; `nights ≤ settings.maxNights`; `checkIn ≤ today + bookingWindowDays`.
- `1 ≤ adults ≤ roomType.maxAdults`; `0 ≤ children ≤ roomType.maxChildren`.
- Names 1–60 chars; email valid; phone normalised to E.164 (`+234…`, accept `0803…`); special requests ≤ 500 chars.
- One room per website booking. Larger parties use the group enquiry form (copy says so).

### `internal/booking.create` — the booking transaction

1. Load settings and the published room type; re-run validation.
2. `free = freeRoomsOfType(...)`. If empty → `ConvexError({code: "SOLD_OUT"})`.
3. Assign `free[0]`.
4. `priceStay(...)` (with offer if passed and still valid).
5. `ref = nextRef(ctx)` — increments `counters` row `booking-<YY>`; format `SLM-<YY>-<4-digit seq>`.
6. `token = base64url(crypto.getRandomValues(32 bytes))`; store `sha256(token)` only.
7. Insert booking (`status: "reserved"`, `paymentStatus: "unpaid"`, `amountDue: total`, `amountPaid: 0`, `source: "website"`).
8. Insert one `occupancy` row per night for the assigned room.
9. Insert `bookingEvents` "created".
10. `ctx.scheduler.runAfter(0, internal.emails.bookingConfirmation, {bookingId, token})` and `…staffNewBooking`.
11. Return `{ref, token}`.

Because steps 2–8 run in one mutation, two guests racing for the last room cannot both succeed: Convex detects the conflicting reads of `occupancy` and retries the later transaction, which then sees the room taken and throws `SOLD_OUT`. Write a `convex-test` test that proves this (two parallel creates for a type with one free room → exactly one succeeds).

## Staff functions (`convex/admin/*`)

Every function starts with `const me = await requireStaff(ctx)` or `requireAdmin(ctx)` from `convex/lib/auth.ts`, which reads `getAuthUserId(ctx)`, loads `staffProfiles`, and throws `FORBIDDEN` if missing or inactive.

| Area | Functions | Role |
|---|---|---|
| Today | `dashboard.today` (arrivals, departures, in-house, occupancy tonight, month-to-date revenue *due*, attention items), `dashboard.occupancyNext14` | staff |
| Reservations | `reservations.list` (filters: status tab, date range, room type, source, search), `get` (with payments + events), `create` (staff booking: any source, optional chosen room, optional rate override with reason), `changeDates`, `moveRoom`, `updateGuest`, `checkIn`, `checkOut`, `cancel` (reason), `markNoShow`, `recordPayment`, `addNote`, `resendConfirmation` | staff |
| Availability | `availability.grid({from, days})` → rooms × nights with booking/block segments; `blocks.create/remove`; `moveRoom` via drag | staff |
| Rooms & rates | `roomTypes.create/update/reorder/setPublished`, `rooms.create/update/setStatus`, `rateOverrides.create/update/remove` | admin |
| Content | `pages.get/save`, `offers.*`, `faqs.*`, `facilities.*`, `gallery.*`, `reviews.*` (approve, feature, add from Google manually) | admin |
| Inquiries | `inquiries.list/setStatus` | staff |
| Uploads | `uploads.generateUploadUrl`, `uploads.attach` (stores `{storageId, alt, width, height}`) | admin |
| Staff | `staff.list`, `staff.invite`, `staff.setRole`, `staff.deactivate` | admin |
| Settings | `settings.get/save` | admin |

Rules for staff writes:
- `changeDates`/`moveRoom`: delete this booking's `occupancy` rows, re-check the target room is free for the new nights (excluding this booking), re-insert, re-price only if dates change (keep manual rate overrides unless staff choose "re-price"). All in one mutation.
- `cancel`/`markNoShow`: delete occupancy rows; status change; email guest on cancel (optional checkbox for no-show).
- `checkOut` before `checkOut` date frees the remaining nights.
- `recordPayment`: append payment, recompute `amountPaid` and `paymentStatus`.
- Every write appends `bookingEvents` and `auditLog`.
- Any write to rooms, rates, offers, pages, gallery, FAQs, facilities, reviews or settings schedules `internal.revalidate.run({tags})`.

## Auth (Convex Auth)

- Provider: `Password` from `@convex-dev/auth/providers/Password`, plus a password-reset flow that emails a one-time code through Resend.
- **Invite-only:** sign-up succeeds only if an unexpired, unused `invites` row exists for that email. Enforce it in the Password provider's `profile` hook or the `createOrUpdateUser` callback (check the current Convex Auth docs for the right hook), then create the `staffProfiles` row with the invite's role and mark the invite used.
- First admin: `npx convex run users:bootstrapAdmin '{"email":"…","name":"…"}'` (internal mutation) creates an admin invite; that person signs up at `/admin/login?mode=signup`.
- Next.js: use the Convex Auth Next.js integration (server provider in the root layout, client provider, and route protection for `/admin/(panel)/*` in middleware/proxy). Redirect signed-out users to `/admin/login`.
- Sessions: 30-day refresh, 1-hour access token defaults are fine. "Keep me signed in" unchecked = session cookie.
- Password policy: min 10 chars; block the 10k most common passwords (small list in repo).
- Rate-limit sign-in attempts per email (5 per 15 min) with the rate limiter component.

## Email (Resend via `@convex-dev/resend`)

Templates in `/emails` (React Email), rendered in a `"use node"` internal action if rendering needs Node, then queued with the Resend component.

| Template | Trigger | To |
|---|---|---|
| `BookingConfirmation` | booking created (website or staff, if guest email present) | guest; BCC none |
| `StaffNewBooking` | website booking created | `STAFF_ALERT_EMAILS` |
| `BookingChanged` | dates/room changed by staff | guest |
| `BookingCancelled` | cancel by guest or staff | guest + staff |
| `PreArrival` | cron, day before arrival 09:00 | guest |
| `ReviewRequest` | cron, day after checkout 12:00 | guest (links to `googleReviewUrl`) |
| `StaffNewInquiry` | inquiry submitted | staff |
| `PasswordReset`, `StaffInvite` | auth | staff |

Every guest email shows: hotel name, ref, room, dates, guests, total due at the hotel, check-in/out times, address with Google Maps link, phone/WhatsApp, "Manage or cancel your booking" link (`/booking/REF?t=TOKEN`), cancellation policy. Plain-text alternative always included. From `EMAIL_FROM`; reply-to the booking mailbox.

## Crons (`convex/crons.ts`, schedules in UTC; Lagos = UTC+1)

| Job | Schedule | Action |
|---|---|---|
| `flagLateArrivals` | hourly at :05 | For `reserved` bookings with `checkIn == today` and Lagos time ≥ `noShowCutoff`: set `lateArrivalFlag`, notify staff once. If `autoCancelNoShows`, mark `no_show` and free nights. |
| `preArrivalReminders` | daily 08:00 UTC | Bookings with `checkIn == tomorrow`, status `reserved`. |
| `reviewRequests` | daily 11:00 UTC | `checked_out` bookings with `checkOut == yesterday`. |
| `expireInvites` | daily 02:00 UTC | Delete expired, unused invites. |

## Revalidation (`convex/revalidate.ts`)

`internalAction run({tags})` → `fetch(SITE_URL + "/api/revalidate", { method: "POST", headers: { "x-revalidate-secret": REVALIDATE_SECRET }, body: JSON.stringify({ tags }) })`. Retry with backoff (scheduler) up to 3 times on non-200.

## Seeding (`convex/seed.ts`)

`internalMutation all` reads `content/seed.json` (imported as a module) and upserts by natural key (`slug`, `key`, `question`, file `src`). Idempotent: safe to run repeatedly. Room units: seed creates placeholder units per type from `seed.json.rooms[].units` (marked `[CONFIRM]`) — replace with the real room list before launch.

## Schema changes during the build

Recorded 2026-10-15 (Stage 1, data layer). All are additive; nothing in the original spec was removed.

| Table | Change | Why |
|---|---|---|
| `roomTypes` | `featured: boolean` | Home "featured rooms" (docs/05); already in seed.json |
| `roomTypes` | `slugRedirects?: string[]` | Old slugs served as 308s after a rename (docs/06) |
| `bookings` | `viewedAt?: number` | Today → "website bookings not yet viewed" (docs/06) |
| `bookings` | index `by_status_checkOut` | `reviewRequests` cron and departures list |
| `pages` | `draftFields?: any` | Preview of unpublished edits (docs/06) |
| `staffProfiles` | `lastSignInAt?: number` | Staff list "last sign-in" (docs/06) |
| `invites` | `name?: string` | `bootstrapAdmin`/invites carry the person's name into their profile |
| `settings` | `gbpNap?: string`, `staffAlertEmails?: string[]` | SEO health NAP check and Settings "alert recipients" (docs/06); env `STAFF_ALERT_EMAILS` is the fallback |
| `offers` | `updatedAt?: number` | Sitemap `lastModified` (docs/07) |
| `inquiries` | `notes?: string` | Internal notes on an inquiry (docs/06) |
| `faqs`, `facilities`, `galleryImages` | indexes `by_question`, `by_title`, `by_src` | Idempotent seeding by natural key |

## Implementation notes (Stage 1)

- **Invite-only sign-up** is enforced in Convex Auth's `afterUserCreatedOrUpdated` callback (`convex/auth.ts` → `claimInvite`). It runs inside the account-creation mutation, so throwing `FORBIDDEN` rolls the new user back. (The Password provider's `profile` hook is synchronous and cannot query invites.)
- **Seeding** (`convex/seed.ts`): default mode inserts missing rows only and never overwrites edits staff made; `'{"overwrite":true}'` refreshes existing rows from seed.json; `'{"units":false}'` skips the development room units. Room units come from `seed.json.devUnits`. Offers and gallery items reference room types by slug; the seed resolves them to IDs.
- **Seed images**: alt text and dimensions come from `content/images.json`, generated from `content/images.md` by `node scripts/build-image-manifest.mjs` (Convex can import JSON, not markdown). Re-run it after editing the manifest.
- **[CONFIRM] content**: room types, offers, facilities, FAQs and gallery items containing a `[CONFIRM]` marker are seeded with `published: false`. Page copy (`pages.fields`) keeps its markers so staff can see what is outstanding; public queries must pass fields through `stripUnconfirmed` (`convex/lib/content.ts`).
- **2026-10-15, client decision ("publish everything"):** the held-back items were reworded so they no longer claim unconfirmed specifics, and published: Penthouse (location claims removed), the long-weekend offer (terms written from its own fields), the check-in/out and cancellation FAQs (no times or policy stated), power/security/laundry facilities (less specific wording) and the dining menu descriptions. Page slots that are still bare `[CONFIRM]` (distances, opening hours, outdoor bar, directions, guide author, "Getting to Akure") stay hidden until the hotel supplies facts. These published texts should still be checked by the hotel (docs/01 open questions).
- **Tests** for Convex live beside the code (`convex/**/*.test.ts`) and import the module map from `tests/convex-modules.ts` (kept outside `convex/` so it is never deployed).

## Implementation notes (Stage 2, booking engine)

- **Files:** `convex/booking.ts` (`internal.booking.create`, the only writer of website bookings), `convex/public/booking.ts` (`search`, `quote`, `reserve`, `forGuest`, `cancelByGuest`), `convex/lib/{stays,bookings,rateLimits,turnstile,images,email}.ts`, `convex/emailData.ts`, `convex/emails.tsx` ("use node"), templates in `emails/`.
- **Manage token** is generated in the `reserve` action (real randomness), passed to `create`, which stores only `sha256(token)` and schedules the confirmation email with the raw token (needed for the link). `forGuest` hashes even for unknown refs and compares in constant time; wrong ref and wrong token look identical (`null` / `NOT_FOUND`).
- **Offers apply automatically**: `bestPrice` (lib/stays.ts) applies any published offer the stay qualifies for when it is cheaper than the nightly rates. `search`, `quote` and `create` all use it, so the guest always books at the price they were shown. A `?offer=` URL param only affects presentation.
- **Queries return `{ ok: false, error }`** for invalid stays (instead of throwing) so `useQuery` UIs can show the message; mutations/actions throw `ConvexError` with a stable `code` and, for input errors, the `field`.
- **Guest self-cancel deadline**: `checkIn` at `checkInTime` (Lagos; midnight if unset) minus `freeCancellationHours` (0 if unset). Cancelling frees occupancy and emails guest + staff.
- **Rate limits** (`convex/lib/rateLimits.ts`): reserve 5/hour per email, 5/hour per phone, 20/hour per IP, 60/min global; guest cancel 10/hour per ref; inquiries 3/hour per email, 10/hour per IP. Client IP comes from `ctx.meta.getRequestMetadata()`.
- **Email** (`convex/lib/email.ts`): while `RESEND_API_KEY` is missing or starts with `re_placeholder`, emails are not sent; the booking history records `email_skipped`. Resend test mode stays on unless `RESEND_TEST_MODE=false`. Staff recipients: Settings `staffAlertEmails`, else `STAFF_ALERT_EMAILS`, else the booking mailbox. Delivery webhooks: `POST /resend-webhook` on the deployment's `.convex.site` URL.
- **Search ordering**: published room types in the hotel's order, with sold-out and too-small types moved to the end (`available: 0`).

## Implementation notes (Stage 4, admin)

- **Files:** `convex/admin/{dashboard,reservations,availability,rooms,content,offers,faqs,facilities,gallery,reviews,inquiries,staff,settings,uploads,audit}.ts`, `convex/lib/{staffBookings,audit,adminValidators,preview}.ts`, `convex/jobs.ts` + `convex/crons.ts`, and `lib/content-schemas.ts` (page field schemas plus SEO health, shared with the UI).
- **Staff bookings and "resend confirmation"** are actions only so the manage-link token comes from real randomness. They call internal mutations that run `requireStaff` themselves (auth passes through `runMutation`). Resending issues a new link; the old one stops working.
- **Staff stay rules:** check-in no earlier than yesterday (for after-midnight walk-ins), up to 365 nights, and the online `maxNights`/booking window don't apply. Special rates store nightly reason `"manual"` and survive date changes unless staff tick "re-price".
- **Moves and date changes** release the booking's own nights and re-check the target room in the same mutation. A conflict returns `CONFLICT`, e.g. "Room 301 is taken by SLM-26-0007 on the night of 2026-10-21. Choose another room." Checked-in guests move from tonight onwards.
- **Sign-up and reset by email code:** the Password provider has `verify` and `reset` Email providers (8-digit codes, 15 minutes, sent by `emails:authCode`). A new account must prove it owns the invited inbox before its first session, so knowing an invited address isn't enough to claim it. With no Resend key, codes are written to the Convex logs (development only). Failed sign-ins are limited by Convex Auth's own limiter (`maxFailedAttempsPerHour: 20`), so the `signInByEmail` limiter was removed.
- **`users:seedAdmin`** (internal action) creates an admin account with a password and a confirmed email, for setting up a deployment before email works.
- **Deactivating** a staff member deletes their `authSessions`/`authRefreshTokens`, and `requireStaff` refuses inactive profiles.
- **New emails:** `BookingChanged`, `PreArrival`, `ReviewRequest` (only if Settings has a Google review link), `StaffInvite`, `AuthCode`, `StaffAlert` (late arrivals).
