import type { Metadata } from "next";
import { Suspense } from "react";
import { GuestBooking } from "@/components/booking/GuestBooking";
import { ConvexClientProvider } from "@/components/convex/ConvexClientProvider";
import { getHotelInfo } from "@/lib/hotel-info";

// Private page reached from the confirmation email; never indexed or cached
// with booking data (the booking loads in the browser with the guest's token).
export const metadata: Metadata = {
  title: "Your booking | Selems Exclusive Hotel & Suites",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export async function generateStaticParams() {
  return [{ ref: "_" }];
}

export default async function GuestBookingPage() {
  const hotel = await getHotelInfo();
  return (
    <div className="container-site max-w-[960px] pt-10 pb-24">
      <ConvexClientProvider>
        <Suspense fallback={<div className="min-h-[50vh]" aria-busy="true" />}>
          <GuestBooking hotel={hotel} />
        </Suspense>
      </ConvexClientProvider>
    </div>
  );
}
