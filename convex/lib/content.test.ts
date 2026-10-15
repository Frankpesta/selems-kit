import { describe, expect, it } from "vitest";
import { containsPlaceholder, stripUnconfirmed } from "./content";
import { passwordProblem } from "./passwords";
import { formatRef, newManageToken, safeEqual, sha256Hex } from "./refs";

describe("stripUnconfirmed", () => {
  it("drops strings, array items and whole objects that are unconfirmed", () => {
    const fields = {
      h1: "Where to stay in Akure",
      checkIn: "[CONFIRM] 14:00",
      distances: [
        { place: "Akure Airport", time: "[CONFIRM]" },
        { place: "FUTA", time: "10 minutes" },
      ],
      hours: ["Breakfast 7–10", "[CONFIRM: dinner hours]"],
      nested: { note: "[CONFIRM] laundry" },
      outdoorBar: { heading: "Evenings in the open air", published: false },
      sections: [{ id: "a", body: "Shown" }, { id: "b", body: "Hidden", published: false }],
    };
    expect(stripUnconfirmed(fields)).toEqual({
      h1: "Where to stay in Akure",
      distances: [{ place: "Akure Airport" }, { place: "FUTA", time: "10 minutes" }],
      hours: ["Breakfast 7–10"],
      sections: [{ id: "a", body: "Shown" }],
    });
  });
  it("leaves clean content untouched and detects markers anywhere", () => {
    const clean = { a: "x", b: [1, { c: "y" }], d: {} };
    expect(stripUnconfirmed(clean)).toEqual(clean);
    expect(containsPlaceholder(clean)).toBe(false);
    expect(containsPlaceholder({ a: [{ b: "text [CONFIRM: floor]" }] })).toBe(true);
  });
});

describe("refs and tokens", () => {
  it("formats booking references", () => {
    expect(formatRef("26", 418)).toBe("SLM-26-0418");
    expect(formatRef("27", 1)).toBe("SLM-27-0001");
  });
  it("makes unguessable url-safe tokens and stable hashes", async () => {
    const a = newManageToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newManageToken()).not.toBe(a);
    const h = await sha256Hex("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(safeEqual(h, await sha256Hex("abc"))).toBe(true);
    expect(safeEqual(h, await sha256Hex("abd"))).toBe(false);
  });
});

describe("password policy", () => {
  it("requires 10+ characters and rejects common passwords", () => {
    expect(passwordProblem("short")).toMatch(/10 characters/);
    expect(passwordProblem("Password123")).toMatch(/too common/);
    expect(passwordProblem("velvet-headboard-302")).toBeNull();
  });
});
