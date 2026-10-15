# 07 — SEO playbook

Target queries: *hotels in Akure*, *best hotels in Akure*, *places to stay in Akure*, *suites in Akure*, *hotel in Ijapo Akure*, *cheap hotels in Akure*, *luxury hotel Akure*, *hotels near FUTA*, *hotels near Akure Airport*, plus room-level queries (*VIP suite Akure*).

## Be honest about what wins these searches

For "hotels in Akure" Google shows the **local map pack** (3 hotels) above organic results, plus Google Hotels price boxes. The map pack is ranked mostly on the **Google Business Profile (GBP)**: relevance, distance, and prominence (reviews, ratings, citations, links). The website feeds that ranking (it's the GBP's website, and its content and structured data confirm relevance), but **no website alone can guarantee top 3**. The build delivers everything the site controls (part A); part B is an operations checklist to hand the hotel at launch.

## A. What the site must do (build requirements)

### A1. Crawlability and indexing

- Full server-rendered HTML for every public page (docs/03). Test with `curl` and Google's URL Inspection: H1, copy, prices, image `src`/`alt`, and JSON-LD present without JS.
- `app/sitemap.ts`: all public pages, each published room (`/rooms/[slug]`), each live offer; `lastModified` from Convex `updatedAt`. Separate **image sitemap** entries (`images` field) for room and gallery photos.
- `app/robots.ts`: allow all; disallow `/admin`, `/book`, `/booking/`, `/api/`; reference the sitemap.
- Canonical URLs on every page (absolute, no query strings; gallery/rooms filter URLs canonicalise to the base page).
- `noindex` on `/book`, `/booking/*`, `/admin/*`, preview mode, 404.
- 308 redirects for every old WordPress URL (table in docs/03); old room slugs on rename (slugRedirects).
- `hreflang` not needed (English only). `<html lang="en-NG">`.

### A2. On-page

| Page | `<title>` (≤ 60) | Meta description (≤ 160) | H1 |
|---|---|---|---|
| Home | Hotel in Akure \| Selems Exclusive Hotel & Suites | Rooms and suites in Ijapo Extension, Akure, from ₦35,000 a night. Restaurant, two bars, free Wi-Fi, 24/7 front office, secure parking. Book direct. | A hotel and suites in Akure, kept to an international standard. |
| Rooms | Rooms & Suites in Akure from ₦35,000 \| Selems Hotel | Compare 9 rooms and suites in Akure: Standard, Deluxe, Executive, Royal, VIP and Penthouse. Prices per night, photos and instant booking. | Rooms and suites in Akure |
| Room | {Room} in Akure — ₦{rate}/night \| Selems Hotel | {short description} Free Wi-Fi, smart TV, 24/7 room service. Reserve now, pay at the hotel. | {Room name} |
| Dining | Restaurant & Bar in Akure \| Selems Exclusive Hotel | Nigerian and continental food, 24-hour room service, an indoor lounge bar and an outdoor bar in Ijapo Extension, Akure. | Restaurant and bars at Selems, Akure |
| Facilities | Hotel Facilities \| Selems Exclusive Hotel, Akure | 24/7 front office, room service, free Wi-Fi, smart TVs, gated parking, restaurant and bars. | Hotel facilities and services |
| Gallery | Photos \| Selems Exclusive Hotel & Suites, Akure | Real photos of our rooms, suites, restaurant and bar in Ijapo Extension, Akure. | Photos of Selems Hotel, Akure |
| Contact | Contact & Directions \| Selems Hotel, Ijapo Akure | Call +234 903 155 9943 or WhatsApp us. Atibiti Layout, Ijapo Extension, Akure, Ondo State. Front office open 24 hours. | Contact the hotel |
| Akure guide | Where to Stay in Akure (2026 Guide) \| Selems Hotel | The best areas to stay in Akure, how to get there, what to see nearby and booking tips from a local hotel team. | Where to stay in Akure: a visitor's guide |

Rules: one H1; logical H2/H3; the word "Akure" in title, H1 or first paragraph of every indexable page; internal links between rooms, guide, dining and contact with descriptive anchor text ("suites in Akure", not "click here"); breadcrumbs everywhere except home. Staff can edit titles/descriptions in admin; these are the seeded defaults.

### A3. Structured data (JSON-LD, built in `lib/seo.ts`, validated in tests)

On every page via the `(site)` layout — the Hotel node:

```json
{
  "@context": "https://schema.org",
  "@type": ["Hotel", "LodgingBusiness"],
  "@id": "https://selemsexclusivehotel.com/#hotel",
  "name": "Selems Exclusive Hotel & Suites",
  "url": "https://selemsexclusivehotel.com/",
  "logo": "https://selemsexclusivehotel.com/images/selems-logo.png",
  "image": ["https://selemsexclusivehotel.com/images/selems-hotel-akure-exterior-front.jpg", "…royal-suite-bed.jpg", "…restaurant-dining-room.jpg"],
  "description": "Hotel and suites in Ijapo Extension, Akure, with a restaurant, two bars, free Wi-Fi and a 24-hour front office.",
  "telephone": "+2349031559943",
  "email": "booking@selemsexclusivehotel.com",
  "address": { "@type": "PostalAddress", "streetAddress": "Atibiti Layout, Ijapo Extension", "addressLocality": "Akure", "addressRegion": "Ondo State", "addressCountry": "NG" },
  "geo": { "@type": "GeoCoordinates", "latitude": "[CONFIRM]", "longitude": "[CONFIRM]" },
  "hasMap": "{settings.googleBusinessUrl}",
  "priceRange": "₦35,000 – ₦75,000",
  "currenciesAccepted": "NGN",
  "paymentAccepted": "Cash, Bank transfer, Card",
  "checkinTime": "14:00", "checkoutTime": "12:00",
  "numberOfRooms": "{count of active rooms}",
  "amenityFeature": [
    { "@type": "LocationFeatureSpecification", "name": "Free Wi-Fi", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "24-hour front desk", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Room service", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Restaurant", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Bar", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Free parking", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Air conditioning", "value": true }
  ],
  "sameAs": ["{facebook}", "{instagram}", "{googleBusinessUrl}"]
}
```

Generate from Settings; omit any property whose value is unset (never emit `[CONFIRM]`). Per page add: `BreadcrumbList`; room pages `HotelRoom` (`name`, `description`, `image`, `occupancy` QuantitativeValue, `bed`, `amenityFeature`, `containedInPlace: {"@id": "#hotel"}`) with an `Offer` (`price`, `priceCurrency: "NGN"`, `priceSpecification` UnitPriceSpecification `unitText: "night"`, `availability`, `url`); `FAQPage` where FAQs render; `Restaurant` on /dining; `Article` on the guide; `ItemList` on /rooms. **Do not add `AggregateRating`/`Review` markup for reviews the hotel collects about itself** — Google ignores self-serving review markup for LocalBusiness and it can trigger a manual action.

Add a Vitest test that builds every JSON-LD object and validates required fields; run the Rich Results Test on staging before launch.

### A4. Images (Google Images and Hotels drive real traffic for hotels)

- Descriptive file names (`selems-hotel-akure-vip-suite-bed.jpg` — seed files already follow this), required alt text, captions in the gallery.
- `next/image` with explicit `sizes`, AVIF/WebP, width/height to avoid CLS; LCP image `priority` + `fetchPriority="high"`; everything else lazy.
- Open Graph images: default (exterior or royal suite, 1200×630 crop) and per room (`opengraph-image.tsx` composing photo + room name + price in brand type).
- Strip EXIF GPS on upload; keep originals ≤ 2400px.

### A5. Performance (Core Web Vitals are a ranking signal and Nigerian mobile networks are slow)

- Budgets in CLAUDE.md. Self-host fonts via next/font, subset Latin, `display: swap`; only two families.
- No client JS on content pages beyond header menu, gallery lightbox, availability bar, booking card.
- Map: static image + link; interactive embed only on click.
- Analytics after consent, via `@next/third-parties`.
- Lighthouse CI on PRs (mobile, simulated 4G): Performance ≥ 90, SEO 100, Accessibility ≥ 95, Best Practices ≥ 95.

### A6. Content for topical relevance

- `/akure-guide` (launch) targets "where to stay in Akure" / "places to stay in Akure". Facts verified, author named, updated date shown, refreshed quarterly.
- Planned follow-ups (each its own page, same template, added via admin "guides" later or as code): *Hotels near FUTA*, *Hotels near Akure Airport*, *Visiting Idanre Hills from Akure*, *Wedding and event accommodation in Akure*. Each answers the query in the first paragraph, links to relevant rooms and contact, has FAQ schema. Don't create thin doorway pages — only publish when there is genuinely useful, specific content.
- Room descriptions must be unique (no copy-paste across rooms); 80–150 words each.

### A7. Measurement

- Google Search Console (domain property, DNS TXT) — submit sitemap at launch; monitor coverage, queries, CWV.
- GA4 events: `view_room`, `check_availability`, `begin_booking`, `booking_reserved` (value = total), `click_call`, `click_whatsapp`, `submit_inquiry`. No PII in events.
- Bing Webmaster Tools (import from GSC).
- Admin "SEO health" panel (docs/06) catches regressions staff might introduce.

## B. Off-site checklist (hand to the hotel at launch)

1. **Google Business Profile:** claim/verify; primary category *Hotel*; exact NAP matching the site (name "Selems Exclusive Hotel & Suites", address, +234 903 155 9943); website = `https://selemsexclusivehotel.com/`; booking link = `/book`; hotel attributes (Wi-Fi, parking, restaurant, bar, room service, 24h front desk); check-in/out times; **25+ real photos** (same set as the site, plus new shoot); post offers weekly; answer Q&A.
2. **Reviews:** the system emails a review request the day after checkout linking to `googleReviewUrl`. Front desk asks happy guests in person (QR card at reception). Reply to every review within 48h. Aim for steady, real reviews — never incentivise or fake them.
3. **Citations / NAP consistency:** Hotels.ng, Booking.com, Tripadvisor, Jumia Travel successors, Expedia/Hotels.com (if used), Facebook, Instagram, Apple Business Connect, Bing Places, VConnect, Nigerian business directories. Same name, address, phone everywhere; fix the old misspelled social links.
4. **Google Hotels free booking links / prices:** require a connectivity partner (a channel manager or booking engine Google supports). Out of scope now; consider when online payment is added.
5. **Local links:** event planners, wedding venues, FUTA conference pages, Ondo State tourism listings, local news features. A few relevant local links beat many generic ones.
6. **Photos:** commission a half-day professional shoot (each room type, bathrooms, restaurant with food, both bars at golden hour, exterior at dusk). Replace placeholders; upload to site and GBP.

## C. Launch SEO checklist

- [ ] All old URLs return 308 to the right new URL (script checks the list).
- [ ] Sitemap + robots live; sitemap submitted in GSC and Bing.
- [ ] Rich Results Test passes for Home (Hotel), a room page (HotelRoom/Offer), /akure-guide (Article, FAQ).
- [ ] No `[CONFIRM]` or bracket text in rendered HTML (CI grep on the built output).
- [ ] Lighthouse mobile ≥ 90 performance, 100 SEO on Home, Rooms, a room page.
- [ ] GBP website/booking URLs updated; NAP identical to site footer.
- [ ] GA4 + GSC verified; key events firing on staging.
