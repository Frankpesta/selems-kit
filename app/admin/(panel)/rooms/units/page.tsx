import type { Metadata } from "next";
import { UnitsView } from "@/components/admin/rooms/UnitsView";

export const metadata: Metadata = { title: "Room units" };

export default function UnitsPage() {
  return <UnitsView />;
}
