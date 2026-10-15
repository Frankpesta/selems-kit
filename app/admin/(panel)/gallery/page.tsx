import type { Metadata } from "next";
import { GalleryView } from "@/components/admin/gallery/GalleryView";

export const metadata: Metadata = { title: "Gallery" };

export default function Page() {
  return <GalleryView />;
}
