import { describe, expect, it } from "vitest";
import { assertKobo, formatNaira, nairaToKobo, parseNairaInput } from "./money";

describe("formatNaira", () => {
  it("formats kobo as whole naira", () => {
    expect(formatNaira(7_000_000)).toBe("₦70,000");
    expect(formatNaira(3_500_000)).toBe("₦35,000");
    expect(formatNaira(0)).toBe("₦0");
  });
});

describe("parseNairaInput", () => {
  it("accepts the ways staff type prices", () => {
    expect(parseNairaInput("70000")).toBe(7_000_000);
    expect(parseNairaInput("70,000")).toBe(7_000_000);
    expect(parseNairaInput("₦70,000")).toBe(7_000_000);
    expect(parseNairaInput(" N70,000.5 ")).toBe(7_000_050);
  });
  it("rejects non-prices", () => {
    expect(parseNairaInput("")).toBeNull();
    expect(parseNairaInput("seventy")).toBeNull();
    expect(parseNairaInput("-500")).toBeNull();
    expect(parseNairaInput("70.123")).toBeNull();
  });
});

describe("kobo integrity", () => {
  it("rounds naira to whole kobo", () => {
    expect(nairaToKobo(0.1 + 0.2)).toBe(30);
  });
  it("rejects floats and negatives", () => {
    expect(() => assertKobo(10.5)).toThrow();
    expect(() => assertKobo(-1)).toThrow();
    expect(assertKobo(7_000_000)).toBe(7_000_000);
  });
});
