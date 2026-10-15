import { v } from "convex/values";
import { addDays, isDateString, nightsBetween } from "../../lib/dates";
import { appError } from "./errors";

// Shared validation (docs/04 "Validation rules"). The booking form's zod schema
// mirrors these; the server is the source of truth.

export const MAX_NAME = 60;
export const MAX_SPECIAL_REQUESTS = 500;

export const stayArgs = {
  checkIn: v.string(),
  checkOut: v.string(),
  adults: v.number(),
  children: v.number(),
};

export const guestArgs = v.object({
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
  phone: v.string(),
});

type StayRules = { maxNights: number; bookingWindowDays: number };

/** Throws INVALID_DATES unless the stay is bookable from `today` (Lagos). Returns the night count. */
export function validateStay(
  stay: { checkIn: string; checkOut: string },
  rules: StayRules,
  today: string,
): number {
  const { checkIn, checkOut } = stay;
  if (!isDateString(checkIn) || !isDateString(checkOut)) {
    throw appError("INVALID_DATES", "Choose valid check-in and check-out dates.");
  }
  if (checkIn < today) throw appError("INVALID_DATES", "Check-in can't be in the past.", "checkIn");
  if (checkOut <= checkIn) {
    throw appError("INVALID_DATES", "Check-out must be after check-in.", "checkOut");
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights > rules.maxNights) {
    throw appError(
      "INVALID_DATES",
      `Online bookings are limited to ${rules.maxNights} nights. Call us for longer stays.`,
      "checkOut",
    );
  }
  if (checkIn > addDays(today, rules.bookingWindowDays)) {
    throw appError("INVALID_DATES", "That date is too far ahead to book online.", "checkIn");
  }
  return nights;
}

/** Throws INVALID_INPUT unless the party fits the room type. */
export function validateGuests(
  party: { adults: number; children: number },
  room: { maxAdults: number; maxChildren: number; name: string },
) {
  const { adults, children } = party;
  if (!Number.isInteger(adults) || adults < 1 || adults > room.maxAdults) {
    throw appError(
      "INVALID_INPUT",
      `The ${room.name} sleeps up to ${room.maxAdults} adult${room.maxAdults === 1 ? "" : "s"}.`,
      "adults",
    );
  }
  if (!Number.isInteger(children) || children < 0 || children > room.maxChildren) {
    throw appError(
      "INVALID_INPUT",
      `The ${room.name} takes up to ${room.maxChildren} child${room.maxChildren === 1 ? "" : "ren"}.`,
      "children",
    );
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

export const isValidEmail = (email: string): boolean =>
  email.length <= 254 && EMAIL_RE.test(normaliseEmail(email));

/**
 * Normalise a phone number to E.164. Nigerian local formats ("0803 123 4567",
 * "803-123-4567", "2348031234567") become "+2348031234567"; international
 * numbers must start with "+". Returns null if it isn't a usable number.
 */
export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(digits)) return null;
  let e164: string;
  if (digits.startsWith("+")) e164 = digits;
  else if (digits.startsWith("234")) e164 = `+${digits}`;
  else if (digits.startsWith("0")) e164 = `+234${digits.slice(1)}`;
  else if (digits.length === 10) e164 = `+234${digits}`;
  else return null;
  if (e164.startsWith("+234")) return /^\+234[789]\d{9}$/.test(e164) ? e164 : null;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");

/** Validates and normalises guest details. Throws INVALID_INPUT naming the field. */
export function validateGuest(guest: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}) {
  const firstName = cleanName(guest.firstName);
  const lastName = cleanName(guest.lastName);
  if (firstName.length < 1 || firstName.length > MAX_NAME) {
    throw appError("INVALID_INPUT", "Enter your first name.", "firstName");
  }
  if (lastName.length < 1 || lastName.length > MAX_NAME) {
    throw appError("INVALID_INPUT", "Enter your last name.", "lastName");
  }
  if (!isValidEmail(guest.email)) {
    throw appError("INVALID_INPUT", "Enter a valid email address.", "email");
  }
  const phone = normalisePhone(guest.phone);
  if (!phone) throw appError("INVALID_INPUT", "Enter a valid phone number.", "phone");
  return { firstName, lastName, email: normaliseEmail(guest.email), phone };
}

export function validateSpecialRequests(text: string | undefined): string | undefined {
  const t = text?.trim();
  if (!t) return undefined;
  if (t.length > MAX_SPECIAL_REQUESTS) {
    throw appError(
      "INVALID_INPUT",
      `Special requests can be up to ${MAX_SPECIAL_REQUESTS} characters.`,
      "specialRequests",
    );
  }
  return t;
}

/** Lower-cased search key kept in sync on every booking write. */
export const bookingSearchText = (b: {
  ref: string;
  guest: { firstName: string; lastName: string; phone: string };
}) => `${b.guest.firstName} ${b.guest.lastName} ${b.guest.phone} ${b.ref}`.toLowerCase();
