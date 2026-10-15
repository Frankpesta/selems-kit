import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import {
  bookingSearchText,
  normalisePhone,
  validateGuest,
  validateGuests,
  validateSpecialRequests,
  validateStay,
} from "./validators";

const rules = { maxNights: 30, bookingWindowDays: 365 };
const today = "2026-10-15";

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ConvexError ? (e.data as { code: string; field?: string }) : { code: "OTHER" };
  }
  return null;
};

describe("validateStay", () => {
  it("accepts a stay starting today and returns nights", () => {
    expect(validateStay({ checkIn: today, checkOut: "2026-10-17" }, rules, today)).toBe(2);
  });
  it("rejects past check-in, reversed or zero-night stays", () => {
    expect(codeOf(() => validateStay({ checkIn: "2026-10-14", checkOut: "2026-10-16" }, rules, today))).toMatchObject({ code: "INVALID_DATES", field: "checkIn" });
    expect(codeOf(() => validateStay({ checkIn: today, checkOut: today }, rules, today))).toMatchObject({ code: "INVALID_DATES", field: "checkOut" });
    expect(codeOf(() => validateStay({ checkIn: "2026-10-20", checkOut: "2026-10-18" }, rules, today))).toMatchObject({ code: "INVALID_DATES" });
  });
  it("enforces max nights and the booking window", () => {
    expect(validateStay({ checkIn: today, checkOut: "2026-11-14" }, rules, today)).toBe(30);
    expect(codeOf(() => validateStay({ checkIn: today, checkOut: "2026-11-15" }, rules, today))).toMatchObject({ code: "INVALID_DATES" });
    expect(validateStay({ checkIn: "2027-10-15", checkOut: "2027-10-16" }, rules, today)).toBe(1);
    expect(codeOf(() => validateStay({ checkIn: "2027-10-16", checkOut: "2027-10-17" }, rules, today))).toMatchObject({ code: "INVALID_DATES" });
  });
  it("rejects malformed and impossible dates", () => {
    expect(codeOf(() => validateStay({ checkIn: "2026-02-30", checkOut: "2026-03-02" }, rules, "2026-01-01"))).toMatchObject({ code: "INVALID_DATES" });
    expect(codeOf(() => validateStay({ checkIn: "16/10/2026", checkOut: "2026-10-18" }, rules, today))).toMatchObject({ code: "INVALID_DATES" });
  });
});

describe("validateGuests", () => {
  const room = { maxAdults: 2, maxChildren: 1, name: "VIP Suite" };
  it("enforces 1 ≤ adults ≤ max and 0 ≤ children ≤ max", () => {
    expect(() => validateGuests({ adults: 2, children: 1 }, room)).not.toThrow();
    expect(codeOf(() => validateGuests({ adults: 0, children: 0 }, room))).toMatchObject({ field: "adults" });
    expect(codeOf(() => validateGuests({ adults: 3, children: 0 }, room))).toMatchObject({ field: "adults" });
    expect(codeOf(() => validateGuests({ adults: 1, children: 2 }, room))).toMatchObject({ field: "children" });
    expect(codeOf(() => validateGuests({ adults: 1.5, children: 0 }, room))).toMatchObject({ field: "adults" });
  });
});

describe("normalisePhone", () => {
  it("normalises Nigerian numbers to E.164", () => {
    expect(normalisePhone("0803 123 4567")).toBe("+2348031234567");
    expect(normalisePhone("08147744484")).toBe("+2348147744484");
    expect(normalisePhone("+234 903 155 9943")).toBe("+2349031559943");
    expect(normalisePhone("2348031234567")).toBe("+2348031234567");
    expect(normalisePhone("803-123-4567")).toBe("+2348031234567");
  });
  it("accepts international numbers with a + prefix", () => {
    expect(normalisePhone("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("rejects junk and short numbers", () => {
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("0803 123")).toBeNull();
    expect(normalisePhone("call me")).toBeNull();
    expect(normalisePhone("+2341031234567")).toBeNull(); // not a mobile/valid NG prefix
  });
});

describe("validateGuest", () => {
  it("normalises names, email and phone", () => {
    expect(
      validateGuest({ firstName: "  Ada  ", lastName: "Okafor   Obi", email: " Ada@Example.COM ", phone: "08031234567" }),
    ).toEqual({ firstName: "Ada", lastName: "Okafor Obi", email: "ada@example.com", phone: "+2348031234567" });
  });
  it("names the bad field", () => {
    const ok = { firstName: "Ada", lastName: "Obi", email: "ada@example.com", phone: "08031234567" };
    expect(codeOf(() => validateGuest({ ...ok, firstName: " " }))).toMatchObject({ field: "firstName" });
    expect(codeOf(() => validateGuest({ ...ok, lastName: "x".repeat(61) }))).toMatchObject({ field: "lastName" });
    expect(codeOf(() => validateGuest({ ...ok, email: "ada@" }))).toMatchObject({ field: "email" });
    expect(codeOf(() => validateGuest({ ...ok, phone: "123" }))).toMatchObject({ field: "phone" });
  });
});

describe("special requests and search text", () => {
  it("trims requests and caps them at 500 characters", () => {
    expect(validateSpecialRequests("  late arrival ")).toBe("late arrival");
    expect(validateSpecialRequests("   ")).toBeUndefined();
    expect(codeOf(() => validateSpecialRequests("x".repeat(501)))).toMatchObject({ field: "specialRequests" });
  });
  it("builds a lower-cased search key", () => {
    expect(
      bookingSearchText({ ref: "SLM-26-0418", guest: { firstName: "Ibrahim", lastName: "Musa", phone: "+2348031234567" } }),
    ).toBe("ibrahim musa +2348031234567 slm-26-0418");
  });
});
