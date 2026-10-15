import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { ConvexClientProvider } from "@/components/convex/ConvexClientProvider";
import { getHotelInfo } from "@/lib/hotel-info";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Book a room | Selems Exclusive Hotel & Suites, Akure",
  description: "Reserve a room or suite at Selems Exclusive Hotel & Suites in Akure. No payment now: pay at the hotel.",
  path: "/book",
  noindex: true,
});

export default async function BookPage() {
  const hotel = await getHotelInfo();
  return (
    <ConvexClientProvider>
      <Suspense fallback={<div className="container-site min-h-[60vh] pt-10" aria-busy="true" />}>
        <BookingFlow hotel={hotel} />
      </Suspense>
    </ConvexClientProvider>
  );
}
