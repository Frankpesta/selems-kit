import type { Metadata } from "next";
import { ReservationPage } from "@/components/admin/reservations/ReservationPage";

export const metadata: Metadata = { title: "Booking" };

export default function BookingPage() {
  return <ReservationPage />;
}
