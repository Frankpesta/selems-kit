import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import { groupNightly, offerApplies, priceStay, rateForNight } from "./pricing";

const vip = "vip" as Id<"roomTypes">;
const std = "std" as Id<"roomTypes">;
const room = { _id: vip, baseRate: 7_000_000, weekendRate: 7_500_000 };
const noWeekend = { _id: std, baseRate: 3_500_000, weekendRate: undefined };
const festive = { startDate: "2026-12-24", endDate: "2026-12-26", rate: 9_000_000, label: "Festive season" };

// 2026-10-15 Thu, 16 Fri, 17 Sat, 18 Sun, 19 Mon
describe("rateForNight", () => {
  it("uses the base rate on weekday nights", () => {
    expect(rateForNight(room, [], "2026-10-15")).toEqual({ date: "2026-10-15", rate: 7_000_000, reason: "standard" });
    expect(rateForNight(room, [], "2026-10-18").reason).toBe("standard"); // Sunday night
  });
  it("uses the weekend rate on Friday and Saturday nights", () => {
    expect(rateForNight(room, [], "2026-10-16")).toMatchObject({ rate: 7_500_000, reason: "weekend" });
    expect(rateForNight(room, [], "2026-10-17")).toMatchObject({ rate: 7_500_000, reason: "weekend" });
  });
  it("falls back to the base rate at weekends when no weekend rate is set", () => {
    expect(rateForNight(noWeekend, [], "2026-10-16")).toMatchObject({ rate: 3_500_000, reason: "standard" });
  });
  it("lets a special-date override beat the weekend rate, inclusive of both ends", () => {
    expect(rateForNight(room, [festive], "2026-12-24")).toMatchObject({ rate: 9_000_000, reason: "Festive season" });
    expect(rateForNight(room, [festive], "2026-12-26")).toMatchObject({ rate: 9_000_000 }); // Saturday, last night
    expect(rateForNight(room, [festive], "2026-12-27").reason).toBe("standard");
  });
});

describe("priceStay", () => {
  it("sums nightly rates across a weekend", () => {
    const p = priceStay(room, [], "2026-10-15", "2026-10-19"); // Thu, Fri, Sat, Sun
    expect(p.nightly.map((n) => n.reason)).toEqual(["standard", "weekend", "weekend", "standard"]);
    expect(p.total).toBe(7_000_000 * 2 + 7_500_000 * 2);
    expect(p.offerApplied).toBe(false);
  });
  it("prices a stay running into an override", () => {
    const p = priceStay(room, [festive], "2026-12-23", "2026-12-25");
    expect(p.nightly.map((n) => n.rate)).toEqual([7_000_000, 9_000_000]);
    expect(p.total).toBe(16_000_000);
  });
  it("returns integer kobo on every line", () => {
    const p = priceStay(room, [festive], "2026-12-20", "2027-01-02");
    expect(p.nightly.every((n) => Number.isInteger(n.rate))).toBe(true);
  });
});

describe("offers", () => {
  const offer = {
    published: true,
    roomTypeIds: [std],
    nights: 3,
    priceTotal: 10_000_000,
    validFrom: "2026-10-01",
    validTo: "2026-12-31",
    arrivalWeekdays: [5], // Friday arrivals
  };
  const stdRoom = noWeekend;

  it("applies to a matching stay and spreads the total, last night absorbing rounding", () => {
    const p = priceStay(stdRoom, [], "2026-10-16", "2026-10-19", offer); // Fri → Mon
    expect(p.offerApplied).toBe(true);
    expect(p.total).toBe(10_000_000);
    expect(p.nightly.map((n) => n.rate)).toEqual([3_333_333, 3_333_333, 3_333_334]);
    expect(p.nightly.every((n) => n.reason === "offer")).toBe(true);
  });
  it("does not apply for the wrong number of nights", () => {
    expect(offerApplies(offer, std, "2026-10-16", "2026-10-18")).toBe(false);
    expect(priceStay(stdRoom, [], "2026-10-16", "2026-10-18", offer).offerApplied).toBe(false);
  });
  it("does not apply on the wrong arrival weekday", () => {
    expect(offerApplies(offer, std, "2026-10-17", "2026-10-20")).toBe(false); // Saturday arrival
  });
  it("applies on any weekday when arrivalWeekdays is empty", () => {
    expect(offerApplies({ ...offer, arrivalWeekdays: [] }, std, "2026-10-17", "2026-10-20")).toBe(true);
  });
  it("does not apply outside the stay window", () => {
    expect(offerApplies(offer, std, "2026-09-25", "2026-09-28")).toBe(false); // before validFrom
    expect(offerApplies(offer, std, "2027-01-01", "2027-01-04")).toBe(false); // after validTo
    // last night (Jan 1) falls outside a window ending Dec 31
    expect(offerApplies(offer, std, "2026-12-30", "2027-01-02")).toBe(false);
    // last night exactly on validTo is fine (Tue 29 → Fri 1 Jan: nights 29, 30, 31)
    expect(offerApplies({ ...offer, arrivalWeekdays: [] }, std, "2026-12-29", "2027-01-01")).toBe(true);
  });
  it("does not apply to other room types or when unpublished", () => {
    expect(offerApplies(offer, vip, "2026-10-16", "2026-10-19")).toBe(false);
    expect(offerApplies({ ...offer, published: false }, std, "2026-10-16", "2026-10-19")).toBe(false);
  });
});

describe("groupNightly", () => {
  it("groups identical nights for the booking card", () => {
    const p = priceStay(room, [], "2026-10-15", "2026-10-18"); // Thu, Fri, Sat
    expect(groupNightly(p.nightly)).toEqual([
      { rate: 7_000_000, reason: "standard", count: 1 },
      { rate: 7_500_000, reason: "weekend", count: 2 },
    ]);
  });
});
