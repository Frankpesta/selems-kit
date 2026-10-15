import { describe, expect, it } from "vitest";
import { formatDate, formatDateShort, formatParty, formatPhone, formatTime } from "./format";

describe("format", () => {
  it("formats business dates without time-zone drift", () => {
    expect(formatDate("2026-10-24")).toBe("Sat 24 Oct 2026");
    expect(formatDateShort("2027-01-01")).toBe("Fri 1 Jan");
  });
  it("formats times, parties and phones", () => {
    expect(formatTime("14:00")).toBe("2:00 pm");
    expect(formatTime("00:30")).toBe("12:30 am");
    expect(formatTime("12:00")).toBe("12:00 pm");
    expect(formatParty(2, 0)).toBe("2 adults");
    expect(formatParty(1, 1)).toBe("1 adult, 1 child");
    expect(formatParty(2, 3)).toBe("2 adults, 3 children");
    expect(formatPhone("+2349031559943")).toBe("+234 903 155 9943");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});
