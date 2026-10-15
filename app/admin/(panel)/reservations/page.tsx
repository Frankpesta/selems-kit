import type { Metadata } from "next";
import { Suspense } from "react";
import { ReservationsView } from "@/components/admin/reservations/ReservationsView";

export const metadata: Metadata = { title: "Reservations" };

export default function ReservationsPage() {
  return (
    <Suspense>
      <ReservationsView />
    </Suspense>
  );
}
