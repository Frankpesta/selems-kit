import type { Metadata } from "next";
import { addressLine, mainPhone } from "./contact";
import { koboToNaira } from "./money";

// Metadata and JSON-LD builders (docs/07 A2, A3). Pure functions over Convex
// data; unit-tested in lib/seo.test.ts. Unset values are omitted, never faked.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://selemsexclusivehotel.com").replace(/\/$/, "");
export const HOTEL_ID = `${SITE_URL}/#hotel`;
export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

type Img = { url: string; alt: string; width: number; height: number } | null | undefined;

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: Img;
  noindex?: boolean;
}): Metadata {
  const url = abs(opts.path);
  const images = opts.image ? [{ url: abs(opts.image.url), width: opts.image.width, height: opts.image.height, alt: opts.image.alt }] : undefined;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      locale: "en_NG",
      siteName: "Selems Exclusive Hotel & Suites",
      url,
      title: opts.title,
      description: opts.description,
      // Leave the key out entirely when unset, so a route's opengraph-image file applies.
      ...(images ? { images } : {}),
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description },
  };
}

// ── JSON-LD ─────────────────────────────────────────────────────────────────

type Settings = {
  hotelName: string;
  address: { street: string; locality: string; region: string; country: string; postalCode?: string };
  geo: { lat: number; lng: number } | null;
  phones: { label: string; number: string; whatsapp: boolean }[];
  emails: { booking: string; info: string };
  checkInTime: string | null;
  checkOutTime: string | null;
  socials: { facebook?: string; instagram?: string; x?: string; tiktok?: string };
  googleBusinessUrl: string | null;
  activeRooms: number;
};

/** Removes undefined/null/empty-array properties so no blank values are emitted. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = v;
  }
  return out as T;
}

const AMENITIES = [
  "Free Wi-Fi",
  "24-hour front desk",
  "Room service",
  "Restaurant",
  "Bar",
  "Free parking",
  "Air conditioning",
];

export function hotelJsonLd(s: Settings, rates: number[], images: string[]) {
  const min = rates.length ? Math.min(...rates) : null;
  const max = rates.length ? Math.max(...rates) : null;
  const naira = (k: number) => `₦${koboToNaira(k).toLocaleString("en-NG")}`;
  return compact({
    "@context": "https://schema.org",
    "@type": ["Hotel", "LodgingBusiness"],
    "@id": HOTEL_ID,
    name: s.hotelName,
    url: `${SITE_URL}/`,
    logo: abs("/images/selems-logo.png"),
    image: images.map(abs),
    description:
      "Hotel and suites in Ijapo Extension, Akure, with a restaurant, two bars, free Wi-Fi and a 24-hour front office.",
    telephone: mainPhone(s.phones)?.number,
    email: s.emails.booking,
    address: compact({
      "@type": "PostalAddress",
      streetAddress: s.address.street,
      addressLocality: s.address.locality,
      addressRegion: s.address.region,
      postalCode: s.address.postalCode,
      addressCountry: s.address.country,
    }),
    geo: s.geo ? { "@type": "GeoCoordinates", latitude: s.geo.lat, longitude: s.geo.lng } : undefined,
    hasMap: s.googleBusinessUrl ?? undefined,
    priceRange: min !== null && max !== null ? `${naira(min)} – ${naira(max)}` : undefined,
    currenciesAccepted: "NGN",
    paymentAccepted: "Cash, Bank transfer, Card",
    checkinTime: s.checkInTime ?? undefined,
    checkoutTime: s.checkOutTime ?? undefined,
    numberOfRooms: s.activeRooms > 0 ? s.activeRooms : undefined,
    amenityFeature: AMENITIES.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    sameAs: [s.socials.facebook, s.socials.instagram, s.socials.x, s.socials.tiktok, s.googleBusinessUrl].filter(
      (u): u is string => !!u,
    ),
  });
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function roomJsonLd(room: {
  slug: string;
  name: string;
  description: string;
  maxAdults: number;
  maxChildren: number;
  baseRate: number;
  amenities: string[];
  facts: string[];
  images: { url: string }[];
  available?: boolean;
}) {
  const url = abs(`/rooms/${room.slug}`);
  const bed = room.facts.find((f) => /bed/i.test(f));
  return compact({
    "@context": "https://schema.org",
    "@type": "HotelRoom",
    "@id": `${url}#room`,
    name: room.name,
    description: room.description,
    url,
    image: room.images.map((i) => abs(i.url)),
    occupancy: { "@type": "QuantitativeValue", maxValue: room.maxAdults + room.maxChildren, unitText: "guests" },
    bed: bed ? { "@type": "BedDetails", numberOfBeds: Number(/\d+/.exec(bed)?.[0] ?? 1) } : undefined,
    amenityFeature: room.amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    containedInPlace: { "@id": HOTEL_ID },
    offers: {
      "@type": "Offer",
      url,
      price: koboToNaira(room.baseRate),
      priceCurrency: "NGN",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: koboToNaira(room.baseRate),
        priceCurrency: "NGN",
        unitText: "night",
      },
      availability: "https://schema.org/InStock",
    },
  });
}

export function itemListJsonLd(rooms: { slug: string; name: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: rooms.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: abs(`/rooms/${r.slug}`),
      name: r.name,
    })),
  };
}

export function restaurantJsonLd(s: Settings, opts: { image?: string; menu?: { name: string; description?: string }[] }) {
  return compact({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${SITE_URL}/dining#restaurant`,
    name: `Restaurant at ${s.hotelName}`,
    url: abs("/dining"),
    image: opts.image ? abs(opts.image) : undefined,
    servesCuisine: ["Nigerian", "Continental"],
    telephone: mainPhone(s.phones)?.number,
    address: { "@type": "PostalAddress", streetAddress: addressLine(s.address) },
    containedInPlace: { "@id": HOTEL_ID },
    hasMenu: opts.menu?.length
      ? {
          "@type": "Menu",
          hasMenuSection: opts.menu.map((m) => compact({ "@type": "MenuSection", name: m.name, description: m.description })),
        }
      : undefined,
  });
}

export function articleJsonLd(opts: {
  headline: string;
  description: string;
  path: string;
  image: string;
  author?: string | null;
  datePublished: string;
  dateModified: string;
  hotelName: string;
}) {
  return compact({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    mainEntityOfPage: abs(opts.path),
    image: [abs(opts.image)],
    author: opts.author
      ? { "@type": "Person", name: opts.author }
      : { "@type": "Organization", name: opts.hotelName, url: `${SITE_URL}/` },
    publisher: { "@id": HOTEL_ID },
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
  });
}

export function contactPageJsonLd(path: string) {
  return { "@context": "https://schema.org", "@type": "ContactPage", url: abs(path), about: { "@id": HOTEL_ID } };
}
