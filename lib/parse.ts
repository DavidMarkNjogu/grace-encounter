import { normalizeKePhone } from "./phone";

export interface ParsedEntry {
  name: string;
  phoneRaw: string;
  phoneCanonical: string | null;
  lineNumber: number;
  originalListNumber: number | null;
}

export interface SkippedEntry {
  rawText: string;
  reason: "no_phone_found" | "invalid_phone_format";
  lineNumber: number;
}

// Relaxed phone regex: removes word boundaries so fused numbers like "peter0117526787" match.
const PHONE_RE = /(\+?254[\s-]?\d[\d\s-]{6,12}\d|0\d[\d\s-]{6,10}\d)/;

// Relaxed boundary: "1.", "371.", "O.", "12)", "12:", "333 ", "545." (even without space).
const ENTRY_BOUNDARY_RE = /^([O0]?\d{1,4})\s*[.):-]?\s*/i;
const LIST_NUMBER_EXTRACT_RE = /^([O0]?\d{1,4})\s*[.):-]?/i;
const BOILERPLATE_RE =
  /^(read more|register\s*(now|here|below)?\.?$|name\.?\s*phone|kindly\s*(note|register)|grace\s*(encounter|arena)|free transport|nairobi[\s-]*kenya|nakuru to uhuru park|entry free|venue|for more info|how to register|instructions?:?)/i;

/** Strip leading numbers, trailing junk, and Title Case proper nouns */
function cleanName(raw: string): string {
  let n = raw
    // Aggressively strip any leading digits, O's, dots, dashes, colons, spaces (e.g. "85.Chris", ".Sheila")
    .replace(/^[\dO\s.:)\-]+/i, "")
    // Strip trailing dashes, dots, colons, underscores, commas
    .replace(/[\s\-\u2013\u2014_.:,;]+$/g, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Title Case: capitalize the first letter of each word and lowercase the rest
  n = n
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return n;
}

function normalizeUnicodeLetters(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function parseRegistrationText(raw: string): {
  entries: ParsedEntry[];
  skipped: SkippedEntry[];
} {
  const cleaned = normalizeUnicodeLetters(raw);
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !BOILERPLATE_RE.test(l));

  const chunks: { text: string; lineNumber: number; isRealEntry: boolean }[] = [];
  let buffer = "";
  let bufferStartLine = 0;

  lines.forEach((line, idx) => {
    const lineHasIndex = ENTRY_BOUNDARY_RE.test(line);
    const bufferHasPhone = PHONE_RE.test(buffer);

    // Flush the buffer if the current line clearly starts a new person
    // OR if the buffer already has a complete person (contains a phone number).
    if ((lineHasIndex || bufferHasPhone) && buffer.trim()) {
      chunks.push({ text: buffer, lineNumber: bufferStartLine, isRealEntry: true });
      buffer = "";
    }

    if (!buffer) {
      bufferStartLine = idx + 1;
    }
    buffer = buffer ? buffer + " " + line : line;
  });
  
  if (buffer.trim()) {
    chunks.push({ text: buffer, lineNumber: bufferStartLine, isRealEntry: true });
  }

  const entries: ParsedEntry[] = [];
  const skipped: SkippedEntry[] = [];

  for (const chunk of chunks) {
    let originalListNumber: number | null = null;
    const numMatch = chunk.text.match(LIST_NUMBER_EXTRACT_RE);
    if (numMatch) {
      originalListNumber = parseInt(numMatch[1].replace(/O/i, "0"), 10);
    }

    const withoutIndex = chunk.text.replace(ENTRY_BOUNDARY_RE, "").trim();
    const phoneMatch = withoutIndex.match(PHONE_RE);

    if (!phoneMatch) {
      if (chunk.isRealEntry) {
        skipped.push({ rawText: chunk.text, reason: "no_phone_found", lineNumber: chunk.lineNumber });
      }
      continue;
    }

    const phoneRaw = phoneMatch[0].trim();
    const rawName = withoutIndex
      .slice(0, phoneMatch.index)
      .trim();

    // Apply the cleanName pipeline: strip residual numbers, trailing junk, Title Case
    const name = cleanName(rawName);

    if (!name) {
      skipped.push({ rawText: chunk.text, reason: "no_phone_found", lineNumber: chunk.lineNumber });
      continue;
    }

    const phoneCanonical = normalizeKePhone(phoneRaw);
    entries.push({ name, phoneRaw, phoneCanonical, lineNumber: chunk.lineNumber, originalListNumber });
  }

  return { entries, skipped };
}

export interface DedupeResult {
  unique: ParsedEntry[];
  invalidPhone: ParsedEntry[];
  duplicatesWithinPaste: ParsedEntry[];
}

export function dedupeParsedEntries(entries: ParsedEntry[]): DedupeResult {
  const seen = new Map<string, ParsedEntry>();
  const invalidPhone: ParsedEntry[] = [];
  const duplicatesWithinPaste: ParsedEntry[] = [];

  for (const entry of entries) {
    if (!entry.phoneCanonical) {
      invalidPhone.push(entry);
      continue;
    }
    if (seen.has(entry.phoneCanonical)) {
      duplicatesWithinPaste.push(entry);
      continue;
    }
    seen.set(entry.phoneCanonical, entry);
  }

  return { unique: Array.from(seen.values()), invalidPhone, duplicatesWithinPaste };
}
