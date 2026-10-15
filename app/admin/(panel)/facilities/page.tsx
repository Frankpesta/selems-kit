import type { Metadata } from "next";
import { FacilitiesView } from "@/components/admin/lists/FacilitiesView";

export const metadata: Metadata = { title: "Facilities" };

export default function Page() {
  return <FacilitiesView />;
}
