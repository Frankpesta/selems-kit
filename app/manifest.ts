import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Selems Exclusive Hotel & Suites",
    short_name: "Selems",
    description: "Hotel and suites in Ijapo Extension, Akure. Book direct, pay at the hotel.",
    start_url: "/",
    display: "browser",
    background_color: "#F3F4F2",
    theme_color: "#17222D",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
