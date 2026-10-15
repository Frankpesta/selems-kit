import type { NextConfig } from "next";

const convexHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

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
