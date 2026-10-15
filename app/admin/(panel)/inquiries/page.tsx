import type { Metadata } from "next";
import { InquiriesView } from "@/components/admin/inquiries/InquiriesView";

export const metadata: Metadata = { title: "Inquiries" };

export default function Page() {
  return <InquiriesView />;
}
