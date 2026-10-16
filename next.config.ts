import type { NextConfig } from "next";

const convexHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

// Content Security Policy (docs/08 Phase 5). Public pages are prerendered, so
// nonces are impossible (they need per-request rendering); Next's inline
// bootstrap scripts need 'unsafe-inline'. Everything else is an allow-list:
// Convex (data + storage), Turnstile, Google Maps embed, and GA4 (loaded only
// after consent, components/site/Analytics.tsx).
const isDev = process.env.NODE_ENV !== "production";
const convexOrigins = convexHost ? [`https://${convexHost}`, `wss://${convexHost}`] : ["https://*.convex.cloud", "wss://*.convex.cloud"];
const ga = ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.analytics.google.com"];
const turnstile = "https://challenges.cloudflare.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${turnstile} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${convexOrigins[0]} ${ga.join(" ")}`,
  "font-src 'self'",
  `connect-src 'self' ${convexOrigins.join(" ")} ${ga.join(" ")} ${turnstile}`,
  `frame-src ${turnstile} https://www.google.com https://maps.google.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // No upgrade-insecure-requests: Vercel is HTTPS-only with HSTS, and WebKit
  // applies it to http://localhost too, which breaks local production tests.
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Nothing on this site is meant to be framed; the admin must never be (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
];

// Old WordPress URLs → new routes (docs/03). Permanent (308) so rankings carry over.
const legacyRooms: [string, string][] = [
  ["diplomatic-suite", "diplomatic-suite"],
  ["business", "business-room"],
  ["executive-double", "executive-double"],
  ["executive-suite", "executive"],
  ["royal-suite", "royal-suite"],
  ["vip-suite", "vip-suite"],
  ["pent-house", "penthouse"],
  ["deluxe-room", "deluxe-room"],
  ["standard-room", "standard-room"],
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  trailingSlash: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 640, 828, 1080, 1280, 1600, 2048],
    remotePatterns: convexHost ? [{ protocol: "https", hostname: convexHost, pathname: "/api/storage/**" }] : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Staff pages are private (Next already sends no-store for them, as they read cookies).
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async redirects() {
    return [
      { source: "/room", destination: "/rooms", permanent: true },
      { source: "/room/", destination: "/rooms", permanent: true },
      ...legacyRooms.flatMap(([from, to]) =>
        from === to ? [] : [{ source: `/rooms/${from}`, destination: `/rooms/${to}`, permanent: true }],
      ),
      { source: "/reservations", destination: "/book", permanent: true },
      { source: "/reservations%20", destination: "/book", permanent: true },
      { source: "/wp-content/uploads/:path*", destination: "/gallery", permanent: true },
      { source: "/wp-admin", destination: "/admin/login", permanent: true },
      { source: "/wp-admin/:path*", destination: "/admin/login", permanent: true },
      { source: "/wp-login.php", destination: "/admin/login", permanent: true },
    ];
  },
};

export default nextConfig;
