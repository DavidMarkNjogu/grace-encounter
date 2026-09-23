import { describe, it, expect } from "vitest";
import { normalizeKePhone, toSearchDigits, maskKePhoneDisplay } from "@/lib/phone";

// ---------------------------------------------------------------------------
// normalizeKePhone — table-driven cases from the punch list (item 2)
// ---------------------------------------------------------------------------
describe("normalizeKePhone", () => {
  const cases: [string, string | null][] = [
    // Punch-list required cases
    ["G11/09644/22",  null],              // letter in input → rejected (student ID)
    ["0712345678",    "254712345678"],     // standard 07xx number
    ["0110964422",    "254110964422"],     // Telkom 011 range — must pass
    ["0746-603-326",  "254746603326"],     // dashes in input

    // Additional coverage
    ["254712345678",  "254712345678"],     // already in 254 format
    ["712345678",     "254712345678"],     // 9-digit without leading 0
    ["0800123456",    null],              // 080x is not a valid Kenyan mobile range
    ["01234567890",   null],              // wrong length
    ["",              null],              // empty
    [" ",             null],              // whitespace only
    ["not a number",  null],              // all letters
    ["0712 345 678",  "254712345678"],    // spaces in number
  ];

  it.each(cases)("normalizeKePhone(%j) → %j", (input, expected) => {
    expect(normalizeKePhone(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// toSearchDigits — short/degenerate inputs must not match every phone (item 1)
// ---------------------------------------------------------------------------
describe("toSearchDigits", () => {
  it('returns "" for bare "0" — prevents matching all 254xxx numbers', () => {
    expect(toSearchDigits("0")).toBe("");
  });

  it('returns "" for bare "254" — prevents matching all canonical phones', () => {
    expect(toSearchDigits("254")).toBe("");
  });

  it('converts "0712" to "254712" (valid partial query)', () => {
    expect(toSearchDigits("0712")).toBe("254712");
  });

  it('converts "712" to "254712" (national format without leading zero)', () => {
    expect(toSearchDigits("712")).toBe("254712");
  });

  it('passes through an already-prefixed string', () => {
    expect(toSearchDigits("254712345678")).toBe("254712345678");
  });

  it('returns "" for empty string', () => {
    expect(toSearchDigits("")).toBe("");
  });

  it('returns "" for whitespace-only string', () => {
    expect(toSearchDigits("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// maskKePhoneDisplay — public page must never reveal the full middle segment
// ---------------------------------------------------------------------------
describe("maskKePhoneDisplay", () => {
  it("masks the middle segment", () => {
    expect(maskKePhoneDisplay("254712345678")).toBe("0712 ••• 678");
  });

  it("does not mask an invalid/unrecognised canonical", () => {
    // Anything that can't be formatted should be returned as-is rather than crashing
    const weird = "12345";
    expect(maskKePhoneDisplay(weird)).toBe(weird);
  });
});
