import type { MetadataRoute } from "next";
import { getGallery, getOffers, getPage, getRooms } from "@/lib/data";
import { abs } from "@/lib/seo";

// Sitemap with image entries (docs/07 A1, A4). lastModified comes from Convex
// updatedAt so Google sees real change dates.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const keys = ["home", "rooms", "dining", "facilities", "gallery", "contact", "akure-guide", "privacy", "terms"] as const;
  const [rooms, gallery, offers, ...pages] = await Promise.all([
    getRooms(),
    getGallery(),
    getOffers(),
    ...keys.map((k) => getPage(k)),
  ]);
  const updated = Object.fromEntries(keys.map((k, i) => [k, pages[i]?.updatedAt ?? Date.now()]));
  const latestRoom = Math.max(0, ...rooms.map((r) => r.updatedAt));
  const page = (path: string, key: (typeof keys)[number], priority: number, images: string[] = [], extra = 0) => ({
    url: abs(path),
    lastModified: new Date(Math.max(updated[key], extra)),
    changeFrequency: "weekly" as const,
    priority,
    images: images.map(abs),
  });

  return [
    page("/", "home", 1, ["/images/selems-hotel-akure-exterior-front.jpg", "/images/selems-hotel-akure-royal-suite-bed.jpg"], latestRoom),
    page("/rooms", "rooms", 0.9, rooms.flatMap((r) => (r.cover ? [r.cover.url] : [])), latestRoom),
    ...rooms.map((r) => ({
      url: abs(`/rooms/${r.slug}`),
      lastModified: new Date(r.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: r.cover ? [abs(r.cover.url)] : [],
    })),
    page("/dining", "dining", 0.7, ["/images/selems-hotel-akure-restaurant-dining-room.jpg", "/images/selems-hotel-akure-indoor-bar.jpg"]),
    page("/facilities", "facilities", 0.6),
    page("/gallery", "gallery", 0.6, gallery.map((g) => g.image.url)),
    page("/akure-guide", "akure-guide", 0.7, ["/images/selems-hotel-akure-exterior-wide.jpg"]),
    page("/contact", "contact", 0.6),
    ...(offers.length
      ? [
          { url: abs("/offers"), lastModified: new Date(Math.max(...offers.map((o) => o.updatedAt ?? 0), 1)), changeFrequency: "weekly" as const, priority: 0.6 },
          ...offers.map((o) => ({
            url: abs(`/offers/${o.slug}`),
            lastModified: new Date(o.updatedAt ?? Date.now()),
            changeFrequency: "weekly" as const,
            priority: 0.6,
            images: o.image ? [abs(o.image.url)] : [],
          })),
        ]
      : []),
    page("/privacy", "privacy", 0.2),
    page("/terms", "terms", 0.2),
  ];
}
