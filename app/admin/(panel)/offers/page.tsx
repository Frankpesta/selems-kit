import type { Metadata } from "next";
import { OffersView } from "@/components/admin/offers/OffersView";

export const metadata: Metadata = { title: "Offers" };

export default function Page() {
  return <OffersView />;
}
