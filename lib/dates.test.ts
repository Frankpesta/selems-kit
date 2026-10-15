import { describe, expect, it } from "vitest";
import {
  addDays,
  eachNight,
  isDateString,
  isWeekendNight,
  nightsBetween,
  nowLagosHHmm,
  staysOverlap,
  todayLagos,
  weekday,
} from "./dates";

describe("addDays", () => {
  it("crosses month ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("crosses year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
  it("handles leap days", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2100-02-28", 1)).toBe("2100-03-01"); // 2100 is not a leap year
  });
});

describe("nightsBetween / eachNight", () => {
  it("counts nights of a stay", () => {
    expect(nightsBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(eachNight("2026-10-24", "2026-10-26")).toEqual(["2026-10-24", "2026-10-25"]);
  });
  it("spans a leap day and a year end", () => {
    expect(eachNight("2028-02-28", "2028-03-01")).toEqual(["2028-02-28", "2028-02-29"]);
    expect(nightsBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
  it("returns no nights for empty or reversed stays", () => {
    expect(eachNight("2026-10-24", "2026-10-24")).toEqual([]);
    expect(eachNight("2026-10-26", "2026-10-24")).toEqual([]);
  });
});

describe("weekday", () => {
  it("knows Friday and Saturday nights are weekend nights", () => {
    expect(weekday("2026-10-16")).toBe(5); // Friday
    expect(isWeekendNight("2026-10-16")).toBe(true);
    expect(isWeekendNight("2026-10-17")).toBe(true);
    expect(isWeekendNight("2026-10-18")).toBe(false); // Sunday
  });
});

describe("todayLagos", () => {
  it("is still today at 22:59 UTC (23:59 in Lagos)", () => {
    expect(todayLagos(Date.UTC(2026, 9, 15, 22, 59))).toBe("2026-10-15");
  });
  it("rolls over at 23:00 UTC (midnight in Lagos)", () => {
    expect(todayLagos(Date.UTC(2026, 9, 15, 23, 0))).toBe("2026-10-16");
    expect(todayLagos(Date.UTC(2026, 9, 15, 23, 30))).toBe("2026-10-16");
  });
  it("rolls over the year at Lagos midnight", () => {
    expect(todayLagos(Date.UTC(2026, 11, 31, 23, 30))).toBe("2027-01-01");
  });
  it("reports Lagos wall-clock time", () => {
    expect(nowLagosHHmm(Date.UTC(2026, 9, 15, 19, 5))).toBe("20:05");
    expect(nowLagosHHmm(Date.UTC(2026, 9, 15, 23, 30))).toBe("00:30");
  });
});

describe("isDateString", () => {
  it("accepts real dates only", () => {
    expect(isDateString("2026-10-15")).toBe(true);
    expect(isDateString("2028-02-29")).toBe(true);
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2026-13-01")).toBe(false);
    expect(isDateString("2026-1-5")).toBe(false);
    expect(isDateString("15/10/2026")).toBe(false);
  });
});

describe("staysOverlap", () => {
  const a = { checkIn: "2026-10-14", checkOut: "2026-10-16" };
  it("lets checkout day be the next check-in day", () => {
    expect(staysOverlap(a, { checkIn: "2026-10-16", checkOut: "2026-10-18" })).toBe(false);
    expect(staysOverlap(a, { checkIn: "2026-10-12", checkOut: "2026-10-14" })).toBe(false);
  });
  it("detects shared nights", () => {
    expect(staysOverlap(a, { checkIn: "2026-10-15", checkOut: "2026-10-17" })).toBe(true);
    expect(staysOverlap(a, { checkIn: "2026-10-10", checkOut: "2026-10-20" })).toBe(true);
  });
});
