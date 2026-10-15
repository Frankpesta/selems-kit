# Design reference

Source markup of the approved design canvas ("Selems Hotel Redesign"), one file per screen, with image paths pointed at `../public/images/` and the shared stylesheet at `site.css`.

These files use the design tool's component format (`<x-dc>`, `<helmet>`, `<sc-for>`, `<sc-if>`, `{{holes}}`), so they **do not run as plain HTML**. Read them as a precise spec of structure, copy, spacing and styles; rebuild them as React Server Components with Tailwind and shadcn per `docs/02` and `docs/05`. Where these files and the docs differ, the docs win.

| File | Screen | Route |
|---|---|---|
| Main.dc.html | Home | `/` |
| Rooms.dc.html | Rooms & Suites | `/rooms` |
| RoomDetail.dc.html | Room page (VIP Suite) | `/rooms/[slug]` |
| Booking.dc.html | Booking flow (5 steps, state machine in the script block) | `/book` |
| Dining.dc.html | Dining & Bars | `/dining` |
| Facilities.dc.html | Facilities | `/facilities` |
| Gallery.dc.html | Gallery | `/gallery` |
| Contact.dc.html | Contact & Location | `/contact` |
| AkureGuide.dc.html | Akure stay guide | `/akure-guide` |
| MobileHome / MobileRoom / MobileBooking | Phone layouts (390px) | — |
| AdminLogin … AdminContent | Admin screens | `/admin/...` |
| site.css | Shared classes and tokens used by every screen | → Tailwind `@theme` |
