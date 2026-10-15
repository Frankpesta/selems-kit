import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";

// docs/07 A1: everything public is crawlable; booking, admin and API are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/book", "/booking/", "/api/"] }],
    sitemap: abs("/sitemap.xml"),
    host: abs("/"),
  };
}
