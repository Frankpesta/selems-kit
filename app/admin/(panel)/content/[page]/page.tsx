import type { Metadata } from "next";
import { ContentEditor } from "@/components/admin/content/ContentEditor";

export const metadata: Metadata = { title: "Content & SEO" };

export default function ContentPage() {
  return <ContentEditor />;
}
