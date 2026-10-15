import "server-only";
import type { HotelInfo } from "@/components/booking/types";
import { getSettings } from "./data";
import { addressLine, displayPhone, mainPhone, mapsHref, telHref, whatsappHref, whatsappPhone } from "./contact";
import { formatTime } from "./format";

/** Hotel details the booking flow and guest page need, as display values. */
export async function getHotelInfo(): Promise<HotelInfo> {
  const s = await getSettings();
  const main = mainPhone(s.phones);
  const wa = whatsappPhone(s.phones);
  return {
    name: s.hotelName,
    address: `${addressLine(s.address)}, Nigeria`,
    mapsHref: mapsHref(s.hotelName, s.address, s.geo),
    phone: { display: displayPhone(main.number), href: telHref(main.number) },
    whatsapp: wa ? { display: displayPhone(wa.number), href: whatsappHref(wa.number) } : null,
    checkInTime: s.checkInTime ? formatTime(s.checkInTime) : null,
    checkOutTime: s.checkOutTime ? formatTime(s.checkOutTime) : null,
    cancellationPolicy: s.cancellationPolicy,
    freeCancellationHours: s.freeCancellationHours,
    noShowCutoff: formatTime(s.noShowCutoff),
    taxNote: s.taxNote,
    maxNights: s.maxNights,
    windowDays: s.bookingWindowDays,
  };
}
