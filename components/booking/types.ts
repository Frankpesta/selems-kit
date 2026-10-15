// Shared types for the booking flow.

export type HotelInfo = {
  name: string;
  address: string;
  mapsHref: string;
  phone: { display: string; href: string };
  whatsapp: { display: string; href: string } | null;
  checkInTime: string | null; // "2:00 pm"
  checkOutTime: string | null;
  cancellationPolicy: string | null;
  freeCancellationHours: number | null;
  noShowCutoff: string; // "8:00 pm"
  taxNote: string | null;
  maxNights: number;
  windowDays: number;
};

export type GuestDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  arrivalWindow: string;
  purpose: "" | "business" | "leisure" | "event" | "other";
  specialRequests: string;
};

export const EMPTY_DETAILS: GuestDetails = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "+234 ",
  arrivalWindow: "",
  purpose: "",
  specialRequests: "",
};

export type Confirmation = {
  ref: string;
  token: string;
  firstName: string;
  email: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  total: number;
};
