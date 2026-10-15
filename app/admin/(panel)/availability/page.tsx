import type { Metadata } from "next";
import { AvailabilityGrid } from "@/components/admin/availability/AvailabilityGrid";

export const metadata: Metadata = { title: "Availability" };

export default function AvailabilityPage() {
  return <AvailabilityGrid />;
}
