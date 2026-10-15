# 01 — Product brief

## The hotel

**Selems Exclusive Hotel & Suites** (brand mark: "SE" monogram, buffalo head, "Selems Exclusive — Hotel & Suites" wordmark in orange and blue on black; logo at `public/images/selems-logo.png`).

| Fact | Value | Source |
|---|---|---|
| Address | Atibiti Layout, Ijapo Extension, Akure, Ondo State, Nigeria | old site |
| Phones | +234 903 155 9943 (main), +234 814 774 4484 (also WhatsApp) | old site contact page |
| Emails | booking@selemsexclusivehotel.com (bookings), info@selemsexclusivehotel.com, selemsexclusivehotel@gmail.com | old site |
| Room types | 9 (see below) | old site rooms page |
| Facilities | 24/7 front office, restaurant (local + continental), 24/7 room service, free Wi-Fi, smart TVs (Netflix/YouTube), indoor bar, outdoor bar, gated on-site parking | old site + photos + client |
| Current offer | "2 Days / 3 Night — ₦100,000" | old site home page (wording inconsistent, see open questions) |

### Room types and current nightly rates

| Room | Slug | Rate (₦) | Category |
|---|---|---|---|
| Standard Room | `standard-room` | 35,000 | Room |
| Business Room | `business-room` | 40,000 | Room |
| Deluxe Room | `deluxe-room` | 45,000 | Room |
| Executive | `executive` | 50,000 | Room |
| Executive Double | `executive-double` | 55,000 | Room |
| Diplomatic Suite | `diplomatic-suite` | 60,000 | Suite |
| Royal Suite | `royal-suite` | 65,000 | Suite |
| VIP Suite | `vip-suite` | 70,000 | Suite |
| Penthouse | `penthouse` | 75,000 | Suite |

All rates are editable in the admin panel; `content/seed.json` holds the launch values.

## Goals

1. **Rank top 3** on Google (organic and the local map pack) for Akure hotel searches. See docs/07 for what the site controls and what it doesn't (Google Business Profile, reviews, citations).
2. **Direct bookings.** A guest on a phone goes from search result to reserved room in under 2 minutes, with no account.
3. **Staff self-service.** Non-technical staff update rates, offers, photos, page text, and manage reservations without a developer.
4. **International standard.** Looks and behaves like a well-run international hotel brand: real photography, restrained typography, fast pages, clear prices in naira.

## Audiences

- **Business travellers** (government visits to Alagbaka, FUTA, corporate) — care about Wi-Fi, desk, quiet, invoices, quick booking by phone.
- **Event and family guests** (weddings, burials, convocations) — book several rooms, often call or WhatsApp, price-sensitive at weekends.
- **Leisure / weekend guests** — respond to offers, care about photos, bar, food.
- **Hotel staff** — front desk (bookings, check-in), management (rates, content).

## Scope

**In:** public website (9 page types + booking flow + booking management page), admin panel (reservations, availability calendar, rooms & rates, content & SEO, offers, gallery, FAQs, inquiries, reviews, staff, settings), transactional email, SEO infrastructure, redirects from old URLs.

**Out (for now):** online payment, guest accounts, channel manager / OTA sync, multi-language, restaurant ordering, POS. Leave clean seams for online payment later (a `payments` table and `paymentStatus` field exist from day one).

## Decisions taken with the client

| Topic | Decision |
|---|---|
| Payment | Pay at hotel only. Online booking reserves the room instantly. |
| No-shows | The desk can cancel a no-show after a cutoff time set in Settings (default 20:00 on arrival day). The system flags late arrivals; it does not auto-cancel unless the setting `autoCancelNoShows` is turned on. |
| Inventory | Each physical room has a number and belongs to one room type. Availability = free rooms of that type for every night of the stay. Online bookings are auto-assigned a room; staff can move them. |
| Staff roles | **Admin** (everything) and **Staff** (reservations, availability, inquiries, check-in/out). |
| Auth | Convex Auth, email + password, invite-only. |
| Email | Resend: booking confirmation, booking change/cancellation, pre-arrival reminder, post-stay review request, staff alert on new booking/inquiry. |
| Images | Convex file storage for admin uploads; seed photos in `/public/images`; served through next/image. |

## Open questions for the hotel (track in an issue; do not guess)

1. **Room sizes.** The old site lists "265 sqm" / "355 sqm" — these are theme template values, not real. Get real sizes or omit.
2. **Phone number mismatch.** Reservations page says 0913 155 9943; everywhere else says 0903 155 9943. Confirm which is right and that it matches Google Business Profile.
3. **Offer wording.** "2 Days / 3 Night" is contradictory. Confirm nights, room type(s), inclusions, valid dates.
4. **Spa.** Old "About" copy mentions a spa. No photo or facility listing supports it. Confirm or drop.
5. **Units and room numbers** per room type (needed for inventory).
6. **Check-in / check-out times, cancellation policy, children and extra-guest policy, taxes/service charge** (state whether rates include VAT/consumption tax).
7. **Opening hours** for restaurant, indoor bar, outdoor bar. Menu (or a PDF) and price range.
8. **Photos missing:** outdoor bar, bathrooms, each room type separately (the old site reuses the same 6 photos across rooms), breakfast/food. A half-day professional shoot is the single biggest upgrade for both conversion and Google Images.
9. **Exact map coordinates** (lat/lng) and the Google Business Profile URL; who owns the GBP login.
10. **Social links.** Old links are misspelled (`facebok.com`, `linkedln.com`). Get the real profile URLs.
11. **Distances** to Akure Airport, FUTA, Alagbaka secretariat, Oja Oba, Idanre Hills (for the location section and guide page).
12. **Power, security, laundry, airport pickup** — confirm what is offered.
