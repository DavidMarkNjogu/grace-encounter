import { describe, it, expect } from "vitest";
import { parseRegistrationText, dedupeParsedEntries } from "@/lib/parse";

// ---------------------------------------------------------------------------
// parseRegistrationText — WhatsApp bulk-paste parser
// Highest risk of silent data corruption: wrong regex = dropped members
// ---------------------------------------------------------------------------
describe("parseRegistrationText", () => {
  it("parses a clean numbered list", () => {
    const text = `
1. John Doe 0712345678
2. Jane Smith 0756789012
3. Peter Kamau 0741111222
`.trim();
    const { entries, skipped } = parseRegistrationText(text);
    expect(entries).toHaveLength(3);
    expect(skipped).toHaveLength(0);
    expect(entries[0].name).toBe("John Doe");
    expect(entries[0].phoneRaw).toBe("0712345678");
    expect(entries[1].name).toBe("Jane Smith");
    expect(entries[2].name).toBe("Peter Kamau");
  });

  it("handles multi-line entries (name on one line, phone on next)", () => {
    const text = `
1. John Doe
   0712345678
2. Jane Smith
   0756789012
`.trim();
    const { entries, skipped } = parseRegistrationText(text);
    expect(entries).toHaveLength(2);
    expect(skipped).toHaveLength(0);
  });

  it("flags numbered entries with no phone for manual review", () => {
    const text = `
1. John Doe (no phone)
2. Jane Smith 0756789012
`.trim();
    const { entries, skipped } = parseRegistrationText(text);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Jane Smith");
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe("no_phone_found");
  });

  it("silently drops un-numbered boilerplate lines", () => {
    const text = `
Read more
Grace Encounter
1. John Doe 0712345678
`.trim();
    const { entries, skipped } = parseRegistrationText(text);
    expect(entries).toHaveLength(1);
    // boilerplate lines are NOT flagged as skipped — they're expected noise
    expect(skipped).toHaveLength(0);
  });

  it("rejects student ID digit strings as phone numbers", () => {
    const text = `
1. Jane Njeri G11/09644/22
`.trim();
    const { entries, skipped } = parseRegistrationText(text);
    // G11/09644/22 contains a letter so normalizeKePhone returns null
    // The entry should be skipped (no valid phone) not silently inserted
    expect(entries).toHaveLength(0);
    expect(skipped.length).toBeGreaterThanOrEqual(1);
  });

  it("handles entries using ) instead of .", () => {
    const text = `
1) Alice Wanjiru 0741000111
2) Bob Ochieng 0756000222
`.trim();
    const { entries } = parseRegistrationText(text);
    expect(entries).toHaveLength(2);
  });

  it("preserves line order across entries", () => {
    const text = `
1. Alpha 0700000001
2. Beta 0700000002
3. Gamma 0700000003
`.trim();
    const { entries } = parseRegistrationText(text);
    expect(entries[0].name).toBe("Alpha");
    expect(entries[1].name).toBe("Beta");
    expect(entries[2].name).toBe("Gamma");
  });

  it("extracts the original list number from the text", () => {
    const text = `
45. Alpha 0700000001
O23) Beta 0700000002
9999: Gamma 0700000003
NoNumber Delta 0700000004
`.trim();
    const { entries } = parseRegistrationText(text);
    expect(entries[0].originalListNumber).toBe(45);
    expect(entries[1].originalListNumber).toBe(23);
    expect(entries[2].originalListNumber).toBe(9999);
    // Delta gets skipped because it has no number, but if we parsed it, it would be null.
    // Let's assert length is 3 since un-numbered lines get dropped by the boundary regex.
    expect(entries).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// dedupeParsedEntries
// ---------------------------------------------------------------------------
describe("dedupeParsedEntries", () => {
  it("separates unique, invalid-phone, and within-paste duplicates", () => {
    const { entries } = parseRegistrationText(`
1. Alice 0712111111
2. Bob 0712222222
3. Alice Again 0712111111
4. No Phone Guy xyz
`.trim());

    const { unique, invalidPhone, duplicatesWithinPaste } = dedupeParsedEntries(entries);
    expect(unique).toHaveLength(2);                // Alice + Bob
    expect(duplicatesWithinPaste).toHaveLength(1); // second 0712111111
    // "No Phone Guy xyz" fails normalizeKePhone → invalid phone in parse, not in dedupe
    // so invalidPhone here should be 0 (parse already dropped it to skipped)
    expect(invalidPhone).toHaveLength(0);
  });

  it("returns all entries as unique when there are no duplicates", () => {
    const { entries } = parseRegistrationText(`
1. Alice 0712111111
2. Bob 0712222222
`.trim());
    const { unique, duplicatesWithinPaste } = dedupeParsedEntries(entries);
    expect(unique).toHaveLength(2);
    expect(duplicatesWithinPaste).toHaveLength(0);
  });
});
