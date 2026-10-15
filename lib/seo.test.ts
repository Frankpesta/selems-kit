import { describe, expect, it } from "vitest";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  hotelJsonLd,
  itemListJsonLd,
  pageMetadata,
  restaurantJsonLd,
  roomJsonLd,
} from "./seo";

const settings = {
  hotelName: "Selems Exclusive Hotel & Suites",
  address: { street: "Atibiti Layout, Ijapo Extension", locality: "Akure", region: "Ondo State", country: "NG" },
  geo: null,
  phones: [
    { label: "Front office", number: "+2349031559943", whatsapp: false },
    { label: "WhatsApp", number: "+2348147744484", whatsapp: true },
  ],
  emails: { booking: "booking@selemsexclusivehotel.com", info: "info@selemsexclusivehotel.com" },
  checkInTime: null,
  checkOutTime: null,
  socials: { instagram: "https://instagram.com/selemsexclusivehotel" },
  googleBusinessUrl: null,
  activeRooms: 23,
};

const noPlaceholders = (o: unknown) => {
  const s = JSON.stringify(o);
  expect(s).not.toMatch(/\[CONFIRM|undefined|null|NaN/);
};

describe("hotelJsonLd", () => {
  it("has the required Hotel fields and omits unset ones", () => {
    const ld = hotelJsonLd(settings, [3_500_000, 7_500_000], ["/images/a.jpg"]);
    expect(ld["@type"]).toEqual(["Hotel", "LodgingBusiness"]);
    expect(ld).toMatchObject({
      name: "Selems Exclusive Hotel & Suites",
      telephone: "+2349031559943",
      priceRange: "₦35,000 – ₦75,000",
      numberOfRooms: 23,
      address: { addressLocality: "Akure", addressRegion: "Ondo State", addressCountry: "NG" },
      sameAs: ["https://instagram.com/selemsexclusivehotel"],
    });
    expect(ld.image).toEqual(["https://selemsexclusivehotel.com/images/a.jpg"]);
    expect(ld).not.toHaveProperty("geo");
    expect(ld).not.toHaveProperty("checkinTime");
    expect(ld).not.toHaveProperty("hasMap");
    noPlaceholders(ld);
  });
  it("includes geo and times once set", () => {
    const ld = hotelJsonLd({ ...settings, geo: { lat: 7.28, lng: 5.2 }, checkInTime: "14:00", checkOutTime: "12:00" }, [1], []);
    expect(ld).toMatchObject({ geo: { latitude: 7.28, longitude: 5.2 }, checkinTime: "14:00", checkoutTime: "12:00" });
  });
});

describe("page-level JSON-LD", () => {
  it("builds breadcrumbs with absolute URLs", () => {
    const ld = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Rooms & suites", path: "/rooms" }]);
    expect(ld.itemListElement[1]).toEqual({ "@type": "ListItem", position: 2, name: "Rooms & suites", item: "https://selemsexclusivehotel.com/rooms" });
  });
  it("builds FAQPage only when there are FAQs", () => {
    expect(faqJsonLd([])).toBeNull();
    expect(faqJsonLd([{ question: "Q?", answer: "A." }])?.mainEntity[0]).toMatchObject({ name: "Q?", acceptedAnswer: { text: "A." } });
  });
  it("builds a HotelRoom with a nightly NGN offer inside the hotel", () => {
    const ld = roomJsonLd({
      slug: "vip-suite",
      name: "VIP Suite",
      description: "A suite.",
      maxAdults: 2,
      maxChildren: 1,
      baseRate: 7_000_000,
      amenities: ["Free Wi-Fi"],
      facts: ["Suite", "1 bed"],
      images: [{ url: "/images/v.jpg" }],
    });
    expect(ld).toMatchObject({
      "@type": "HotelRoom",
      name: "VIP Suite",
      containedInPlace: { "@id": "https://selemsexclusivehotel.com/#hotel" },
      occupancy: { maxValue: 3 },
      bed: { numberOfBeds: 1 },
      offers: { price: 70000, priceCurrency: "NGN", priceSpecification: { unitText: "night" } },
    });
    noPlaceholders(ld);
  });
  it("builds ItemList, Restaurant and Article", () => {
    expect(itemListJsonLd([{ slug: "a", name: "A" }]).itemListElement[0].url).toBe("https://selemsexclusivehotel.com/rooms/a");
    const r = restaurantJsonLd(settings, { menu: [{ name: "Nigerian kitchen", description: "Soups" }] });
    expect(r).toMatchObject({ "@type": "Restaurant", servesCuisine: ["Nigerian", "Continental"], hasMenu: { hasMenuSection: [{ name: "Nigerian kitchen" }] } });
    noPlaceholders(r);
    const a = articleJsonLd({ headline: "Where to stay", description: "d", path: "/akure-guide", image: "/i.jpg", author: null, datePublished: "2026-10-15", dateModified: "2026-10-15", hotelName: "Selems" });
    expect(a.author).toMatchObject({ "@type": "Organization" });
    noPlaceholders(a);
  });
});

describe("pageMetadata", () => {
  it("sets an absolute canonical and noindex when asked", () => {
    const m = pageMetadata({ title: "T", description: "D", path: "/rooms", noindex: true });
    expect(m.alternates?.canonical).toBe("https://selemsexclusivehotel.com/rooms");
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});
