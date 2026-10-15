import type { Metadata } from "next";
import { FaqsView } from "@/components/admin/lists/FaqsView";

export const metadata: Metadata = { title: "FAQs" };

export default function Page() {
  return <FaqsView />;
}
