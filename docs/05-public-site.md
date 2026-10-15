# 05 — Public website

Every page: Server Component, `generateMetadata` from Convex `pages.seoTitle/seoDescription` (fallbacks in docs/07), canonical URL, breadcrumbs (except home), JSON-LD from `lib/seo.ts`, `SiteHeader` + `SiteFooter` + `MobileBookBar` from the `(site)` layout. Copy below is launch copy; it is seeded into `pages.fields` so staff can edit it later.

## Global

- **Utility bar + header:** see docs/02. Utility bar: address, "Front office open 24/7", phone `+234 903 155 9943` (`tel:`), WhatsApp. Header (single row, never wraps): wordmark, links Rooms & Suites `/rooms`, Dining & Bars `/dining`, Facilities `/facilities`, Gallery `/gallery`, Akure Guide `/akure-guide`, Contact `/contact`, CTA "Book a room" → `/book`. Menu sheet below 1100px.
- **Footer:** logo, address, columns *Stay* (Rooms & suites, Book a room, Offers, Where to stay in Akure), *Hotel* (Dining & bars, Facilities, Gallery, Contact), *Reservations* (phones, booking email, socials). Legal row: © year, Privacy, Booking terms.
- **WhatsApp:** floating button bottom-right on desktop only (on phones the bottom bar exists); opens `https://wa.me/2348147744484?text=` with a prefilled "Hello Selems, I'd like to ask about a room for [dates]".
- **Cookie/analytics consent:** minimal banner; GA4 loads only after consent.
- **404:** "This page has moved" + links to Rooms, Book, Contact (old WordPress URLs are redirected, but stragglers land here).

## Home `/`

1. **Hero (dark).** Eyebrow "Ijapo Extension · Akure, Ondo State". H1 (editable; launch: "A hotel and suites in Akure, kept to an international standard."). Lede with "from ₦35,000" pulled live from the cheapest published room. Buttons: "Check availability" (`/book`), "See rooms & prices" (`/rooms`). Right: 3-photo mosaic (editable; launch: royal-suite-bed, corridor-chandelier, indoor-bar). The first mosaic image is the LCP element: `priority`, `sizes` set, AVIF.
2. **AvailabilityBar** overlapping the hero.
3. **About + FactsStrip** (9 room types, 24/7, 2 bars, from ₦35k — numbers derived from data where possible).
4. **Featured rooms:** 3 room types flagged `featured` (launch: Standard, Deluxe, VIP Suite) + "Compare all 9 rooms".
5. **Offer band** (velvet) — the first published offer with `showOnHome`; hidden if none.
6. **Dining split** — two photos + copy + link.
7. **Included with every stay** — 6 facilities (published, sorted).
8. **Location** — address as `<address>`, distances list from `pages.fields.distances` (hidden until confirmed), exterior photo, Google Map: render a static map image with a "Open in Google Maps" link (no iframe until the user clicks "Show interactive map" — protects LCP and privacy).
9. **Reviews** — up to 3 approved+featured reviews; heading shows Google rating and count only if entered in settings. Hide the section entirely if there are no reviews.
10. **FAQ** — FAQs tagged `home` (FAQPage JSON-LD).
11. Footer.

## Rooms `/rooms`

H1 "Rooms and suites in Akure". Filter chips (client island, URL `?type=suite`, `?max=50000`) and sort (`?sort=price-desc`); server renders the full list so crawlers see all 9. Grid of `RoomCard`s. "In every room" checklist (from `pages.fields.inEveryRoom`). Compare table (name, type, sleeps, lounge, from-rate, Book link). Group-booking CTA band → `/contact?subject=group`. JSON-LD: `ItemList` of `HotelRoom` URLs.

## Room page `/rooms/[slug]`

`generateStaticParams` from published slugs; `notFound()` for unpublished.

- Breadcrumbs Home / Rooms & suites / {name}.
- Gallery: cover + 4 thumbnails; "All N photos" opens lightbox. Alt text from data.
- Left column: `Tag` (Suite/Room), H1 = room name, facts row (beds, bathroom, lounge, sleeps, size if set), description, amenities checklist, "Good to know" list from settings (check-in, check-out, cancellation, children/extra guest, parking) — each row only if set, "Other suites/rooms" (3).
- Right: **booking card** (client island). Price "₦70,000 / night" (base) with "weekend ₦75,000" hint if different. Date range + guests. On change, `useQuery(api.public.booking.quote)` → nightly breakdown (group identical nights: "₦70,000 × 2 nights", "₦75,000 × 1 weekend night"), tax note from settings, total, availability line ("Available" / "Only 1 left" / "Sold out for these dates — try other dates or call us"). Button "Reserve this room" → `/book?room=vip-suite&checkIn=…&checkOut=…&adults=…` (skips step 2). Under it: "No payment now. Pay at the hotel." and phone/WhatsApp.
- Phone layout: sticky bottom bar "₦70,000 per night · Choose dates" opens a full-screen date sheet (see canvas "Phone — Booking step").
- JSON-LD: `HotelRoom` + `Offer` (price, `priceCurrency: NGN`, `unitText: "night"`), BreadcrumbList.

## Booking flow `/book`

One client component (`BookingFlow`) inside a server shell (noindex, minimal header with "Secure booking · Help: phone"). State in the URL search params so refresh/back work: `step`, `checkIn`, `checkOut`, `adults`, `children`, `room`, `offer`. Guest details kept in `sessionStorage` (cleared on success).

| Step | Content | Validation / behaviour |
|---|---|---|
| 1 Dates | Range calendar (2 months desktop, 1 on phones, past dates disabled, max window from settings), adults (1–4), children (0–3). Shows "N nights · Sat 24 to Mon 26 Oct". | `checkOut > checkIn`, ≤ maxNights. |
| 2 Room | `booking.search` results as selectable cards: photo, name, facts, total for stay + per-night, "Only N left", sold-out cards disabled at bottom. Offer badge when an offer applies. | Must pick one available. Skipped if `room` param present and available. |
| 3 Your details | First/last name, email, phone (prefilled `+234`), expected arrival window, purpose, special requests (≤ 500). | zod schema mirroring Convex validators; inline errors. |
| 4 Review & reserve | Full summary, cancellation policy, check-in/out times, "Pay at the hotel on arrival (cash, transfer or card)", checkbox "I agree to the booking terms", Turnstile (invisible). Button **"Reserve — pay at the hotel"**. | Calls `booking.reserve`. On `SOLD_OUT`: show "Someone just booked the last {room} for these dates" and return to step 2 with fresh results. On `RATE_LIMITED`: ask to call. |
| 5 Confirmed | Check icon, "You're booked, {first name}.", ref, summary, "We've emailed {email}", buttons: Add to calendar (.ics download generated client-side), Get directions, WhatsApp the front desk, Manage booking. | Replace history entry so Back doesn't resubmit. Fire GA4 `purchase`-style event `booking_reserved` with value (no PII). |

`BookingSummary` stays visible (sticky right on desktop; collapsible top bar on phones).

## Guest booking page `/booking/[ref]?t=…`

noindex. Shows status, dates, room, total due, hotel contacts, map link. "Cancel booking" if `cancelByGuest` is allowed (confirmation step inside the page, not `confirm()`), otherwise "To change this booking, call or WhatsApp us". Invalid token → generic "We couldn't find that booking" (don't reveal existence).

## Dining & Bars `/dining`

Split dark hero (copy + restaurant photo). Restaurant: hours list (from page fields; hide unset), 3 menu categories with items + prices if provided (else short descriptions), optional menu PDF link (uploaded in admin). Indoor bar (3 photos), outdoor bar (photo required before this block publishes), private dining CTA → contact `?subject=group`. JSON-LD: `Restaurant` (servesCuisine "Nigerian", "Continental"; `containedInPlace` the Hotel), `Menu` if items exist. FAQ (tag `dining`).

## Facilities `/facilities`

Intro, alternating photo/text rows from `facilities` table, "Practical details" grid (power, security, laundry — each published only when confirmed). JSON-LD: amenities already on the Hotel node.

## Gallery `/gallery`

H1 "Photos of Selems Hotel, Akure". Filter chips (All, Rooms, Suites, Dining & bar, The hotel) as links (`?c=rooms`) so each filter is crawlable but canonical stays `/gallery`. CSS-columns masonry with `<figure>`/`<figcaption>`; lightbox with keyboard and swipe. Images lazy-loaded except the first 6. Image sitemap entries (docs/07).

## Contact `/contact`

Three ways (Call, WhatsApp, Email) as large selectable text plus `tel:`/`wa.me`/`mailto:` links. Message form: name, phone, email, subject (Reservation enquiry, Group or event booking, Request, Suggestion, Testimony, Complaint — preselect from `?subject=`), message; Turnstile; success state inline ("Thanks — we reply within … during the day"). Address block, static map + link, directions text (page field). JSON-LD: `ContactPage`.

## Akure guide `/akure-guide`

Long-form article (staff-editable sections), written to answer "where to stay in Akure". Layout: H1, intro, author + "Updated" date (from `updatedAt`), hero photo, sticky table of contents (desktop), sections: Akure at a glance · Best areas to stay (Alagbaka, Ijapo Estate & Extension, Oba-Ile, FUTA axis) · Getting to Akure · What to see nearby (Idanre Hills, Deji's palace, Oja Oba) · Booking tips · CTA card · FAQs. Facts with `[CONFIRM]` in seed stay hidden until verified. JSON-LD: `Article` (author, datePublished, dateModified, image), FAQPage, BreadcrumbList. Internal links to rooms and contact.

## Offers `/offers/[slug]` (optional landing)

Generated for each published offer: hero image, title, what's included, price, valid dates and arrival days, terms, "Book this offer" → `/book?offer=slug`. Unpublished/expired → 410-style page linking to rooms (and removed from sitemap).

## Legal

`/privacy` (what booking data is kept, why, retention: 24 months after stay, contact for deletion — NDPA 2023 compliant wording to be reviewed by the client), `/terms` (booking terms, cancellation, no-show, check-in ID requirement, children). Both editable in admin.

## Accessibility and quality checklist (each page)

One H1; landmarks; skip link; all images alt; focus visible; forms labelled with errors announced (`aria-live`); colour contrast AA; keyboard-usable calendar and lightbox; works at 320px width; no layout shift from fonts or images (explicit width/height).
