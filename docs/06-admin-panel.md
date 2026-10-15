# 06 — Admin panel

Lives at `/admin`. `noindex, nofollow`, excluded from sitemap and robots-disallowed. Client-rendered with Convex `useQuery`/`useMutation` (real-time: two front-desk PCs see changes instantly). Works on a tablet at the front desk (min width 768px is the main target; usable on phones for lookups).

## Roles

| Capability | Staff | Admin |
|---|---|---|
| Today dashboard | ✓ | ✓ |
| Reservations: view, create, edit guest, change dates, move room, check in/out, cancel, no-show, record payment, notes | ✓ | ✓ |
| Availability calendar, block/unblock rooms | ✓ | ✓ |
| Inquiries | ✓ | ✓ |
| Rooms & rates (types, units, prices, special-date rates, photos) | – | ✓ |
| Content & SEO, offers, FAQs, gallery, facilities, reviews | – | ✓ |
| Staff (invite, role, deactivate) | – | ✓ |
| Settings | – | ✓ |
| Revenue figures on dashboard | hidden | ✓ |

Hide links a role cannot use; enforce on the server regardless.

## Shell

Ink sidebar (Today, Reservations [badge: needs-attention count], Availability, Rooms & rates; *Website*: Content & SEO, Offers, Gallery, FAQs, Reviews, Inquiries [badge: new]; *Hotel*: Staff, Settings), user chip with role and Sign out. Top bar per page: title, subtitle, primary action. Global search (⌘K / Ctrl+K): guest name, phone or ref → jump to reservation. Toasts for every save ("Saved", "Booking moved to 302"). Destructive actions use an in-page `AlertDialog` with the consequence spelled out ("Cancel SLM-26-0424? Room 204 becomes free for 14–16 Oct. Ibrahim Musa will get a cancellation email.").

## Sign in `/admin/login`

Email + password, "Keep me signed in on this device", "Forgot password?" (email code via Resend). `?mode=signup` shows "Create your staff account" only for invited emails (server rejects others with "This email hasn't been invited. Ask the hotel admin."). Left panel: corridor photo with "Bookings, rooms and prices in one place."

## Today `/admin`

- KPI tiles: Arrivals today (n checked in), Departures today (n late checkout), In house tonight (of N active rooms), Occupancy tonight %, (Admin only) Amount due this month and room nights.
- **Arrivals today** table: guest + ref, room type + room number, nights, payment status pill, status pill (Expected HH:mm window / Checked in / Late), action button (Check in · Call guest).
- **Departures today** (tab or second table): balance due highlighted; "Check out" action blocked with a warning if balance > 0 (can override with reason).
- **Needs attention:** late arrivals past cutoff, website bookings created in the last 24h not yet viewed, new inquiries, reviews awaiting approval, rooms out of service.
- **Occupancy next 14 days** bar chart (weekend nights in amber), with exact % on hover and as visually-hidden text.

## Reservations `/admin/reservations`

- Tabs: All · Needs attention · Arriving (next 7 days) · In house · Checked out · Cancelled/No-show.
- Filters: search (uses `search_guest` index), date range, room type, source. URL-synced.
- Table: Ref, Guest, Room (type + number), Dates, Nights, Source, Total, Paid, Status. Row click opens the details panel (right side ≥1280px, `Sheet` below).
- **Details panel / page** (`/admin/reservations/[id]`): guest contact (click-to-call, WhatsApp link, email), stay, room, price lines (nightly), payments list + "Record payment" (amount, method: cash/transfer/POS/other, note), balance, special requests, history timeline (bookingEvents), internal notes. Actions: Check in, Check out, Change dates, Move room, Edit guest, Resend confirmation, Cancel, Mark no-show.
- **New booking** dialog (phone/WhatsApp/walk-in): dates → available types with counts → optional specific room → guest details (email optional for walk-ins) → optional rate override (requires reason) → create. Shows live price.

## Availability `/admin/availability`

Rooms (grouped by type, ordered by number) × 14 nights (prev/next/today; date picker jump). Booking segments coloured by state: reserved (blue), checked in (green), late/needs attention (amber), cancelled not shown, blocks (hatched grey with reason). Weekend columns tinted; today column highlighted.

Interactions:
- Click a segment → reservation panel.
- Drag a segment to another room row (same nights) → `moveRoom` (server re-validates; on conflict snap back with toast).
- Drag-select empty nights on a row → menu: "New booking for room 203, 3 nights" or "Block room".
- Keyboard alternative: every action available from the reservation panel.
- Footer row: free rooms per night by type ("Suites free: 2 · Rooms free: 6").

## Rooms & rates `/admin/rooms`

- Room types table: name, units (active/total), weekday rate, weekend rate, on-site toggle, drag handle to reorder (sets `sortOrder`, controls site order).
- **Edit room type:** name, URL slug (warn: changing it creates a redirect automatically — store old slugs in a `slugRedirects` list and serve 308s), category, weekday rate, weekend rate (Fri/Sat nights), max adults/children, size (optional), facts, amenities (chips from a managed list + custom), short description (card), description (page), photos (upload, drag reorder, first = cover, **alt text required** before publish), SEO title/description (with counters and Google preview), preview link, Save/Discard. Price inputs accept "70000", "70,000", "₦70,000".
- **Special-date rates:** list per type; add range (first night–last night), rate, label. Show overlapping ranges as an error.
- **Room units** `/admin/rooms/units`: number, type, floor, status (active / out of service + note). Taking a room out of service with future bookings lists them and requires moving them first.

## Content & SEO `/admin/content/[page]`

Left list of pages (Home, Rooms, Dining, Facilities, Gallery, Contact, Akure guide, Privacy, Booking terms) and shared items (Offers, FAQs, Facilities, Hotel details → Settings). Middle: form generated from the page's field schema (`lib/content-schemas.ts`): headings, paragraphs (plain textarea with simple markdown: bold, links, lists), image pickers (from gallery or upload), lists (distances, hours, menu items). Right: **Google search appearance** (title, description with live counters — green ≤ 60/160, amber over — and a SERP preview) and **SEO health** checks:

- Title 30–60 chars and contains "Akure" (home, rooms, guide).
- Description 70–160 chars.
- Exactly one H1 field filled.
- All images on the page have alt text.
- No `[CONFIRM]`/bracket placeholders in published text.
- Hotel phone/address in Settings match what's entered as the Google Business Profile NAP (manual field) — warn if different.

"Publish changes" saves and triggers revalidation; "Preview" opens the page with `?preview=<signed token>` showing draft fields (draft fields stored alongside published ones as `draftFields`).

### Offers `/admin/offers`

List with status (Scheduled, Live, Expired, Hidden). Form: title, slug, summary, description, image, nights, total price, room types it applies to, arrival weekdays, stay window (from/to), terms, show on Home toggle, published toggle. Live preview of the Home offer band.

### Gallery `/admin/gallery`

Grid; upload many at once (client resizes to max 2400px, strips EXIF location, shows progress); each needs caption, alt text, category, optional room type; drag to reorder; publish toggle. Warn when a photo is wider than 2400px or smaller than 1200px.

### FAQs, Facilities, Reviews

Simple sortable lists with publish toggles. FAQs choose which pages they appear on. Reviews: add manually (paste a Google review with author first name and date — get permission per Google's terms; do **not** mark these up as Review schema), approve guest-email reviews, feature up to 6.

## Inquiries `/admin/inquiries`

Inbox: new / replied / closed. Row shows subject pill, name, first line, time. Detail: full message, contact buttons, "Mark replied", "Create booking from this" (prefills new-booking dialog), notes.

## Staff `/admin/staff` (admin)

List: name, email, role, active, last sign-in. Invite (email, role) → sends StaffInvite email with sign-up link valid 7 days. Change role, deactivate (blocks sign-in immediately by `active: false` check in `requireStaff`). An admin cannot deactivate themselves or remove the last admin.

## Settings `/admin/settings` (admin)

Hotel details (name, address, geo lat/lng with a "pick on map" link, phones with WhatsApp flag, emails), policies (check-in/out times, cancellation text, free-cancellation hours, children policy, tax note), booking rules (max nights, booking window, no-show cutoff, auto-cancel no-shows toggle), links (socials, Google Business Profile URL, Google review URL, map embed URL), alert recipients. Saving re-validates every page (NAP appears site-wide).

## Audit and safety

- Every staff write logs `auditLog` (who, what, when, summary). Reservation history shows the booking's events.
- Soft-delete only for bookings (cancel), never hard-delete.
- Export reservations to CSV (current filter) for accounting.
