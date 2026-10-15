// Data every booking email is rendered from (built by convex/emailData.ts).
// Plain strings only: templates do no formatting or lookups of their own.

export type HotelContact = {
  name: string;
  address: string;
  mapsUrl: string;
  phone: string; // display form
  phoneHref: string; // tel:
  whatsappHref: string | null; // https://wa.me/…
  bookingEmail: string;
  siteUrl: string;
  logoUrl: string;
};

export type BookingEmailModel = {
  hotel: HotelContact;
  ref: string;
  guestFirstName: string;
  guestFullName: string;
  guestEmail: string;
  guestPhone: string;
  roomName: string;
  checkIn: string; // "Sat 24 Oct 2026"
  checkOut: string;
  nights: string; // "2 nights"
  party: string; // "2 adults, 1 child"
  priceLines: { label: string; amount: string }[]; // "₦70,000 × 2 nights"
  offerTitle: string | null;
  totalDue: string; // "₦140,000"
  checkInTime: string | null; // "2:00 pm"
  checkOutTime: string | null;
  cancellationPolicy: string | null;
  arrivalWindow: string | null;
  specialRequests: string | null;
  manageUrl: string | null; // only in guest emails
  adminUrl: string; // only shown to staff
};
