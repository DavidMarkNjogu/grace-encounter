import { normalizeKePhone } from "./phone";

export interface ParsedEntry {
  name: string;
  phoneRaw: string;
  phoneCanonical: string | null;
  lineNumber: number;
}

export interface SkippedEntry {
  rawText: string;
  reason: "no_phone_found" | "invalid_phone_format";
  lineNumber: number;
}

const PHONE_RE = /(?:\+?254[\s-]?\d[\d\s-]{6,12}\d|(?<!\d)0\d[\d\s-]{6,10}\d(?!\d))/;
// A new list entry: "1.", "371.", "O." (capital O used as zero in this group's
// stylized text), "12)", "12:" — at the very start of a line.
const ENTRY_BOUNDARY_RE = /^[O0]\d{0,3}[.):]|^\d{1,4}\s*[.):]/;
const BOILERPLATE_RE =
  /^(read more|register now\.*|name\.\s*phone|kindly note|grace (encounter|arena)|free transport|nairobi[\s-]*kenya|nakuru to uhuru park|entry free|venue|for more info)/i;

function normalizeUnicodeLetters(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function toTitleCase(str: string): string {
  return str.replace(
    /\w+/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
}

/**
 * Parses messy pasted WhatsApp registration text into name/phone pairs.
 * Groups lines into entries at each recognized list-index boundary, rather
 * than waiting for a phone number to appear — so one person who forgot to
 * include a number can't swallow the next real entry's name into their own.
 */
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
  let bufferIsRealEntry = false;

  lines.forEach((line, idx) => {
    const isBoundary = ENTRY_BOUNDARY_RE.test(line);

    if (isBoundary && buffer) {
      chunks.push({ text: buffer, lineNumber: bufferStartLine, isRealEntry: bufferIsRealEntry });
      buffer = line;
      bufferStartLine = idx + 1;
      bufferIsRealEntry = true;
    } else {
      if (!buffer) {
        bufferStartLine = idx + 1;
        bufferIsRealEntry = isBoundary;
      }
      buffer = buffer ? `${buffer} ${line}` : line;
    }
  });
  if (buffer) chunks.push({ text: buffer, lineNumber: bufferStartLine, isRealEntry: bufferIsRealEntry });

  const entries: ParsedEntry[] = [];
  const skipped: SkippedEntry[] = [];

  for (const chunk of chunks) {
    const withoutIndex = chunk.text.replace(ENTRY_BOUNDARY_RE, "").trim();
    const phoneMatch = withoutIndex.match(PHONE_RE);

    if (!phoneMatch) {
      // A numbered list entry with no recognizable phone always gets flagged
      // for manual review. Unnumbered leftover fragments (stray preamble
      // text that slipped past the boilerplate filter) are dropped silently.
      if (chunk.isRealEntry) {
        skipped.push({ rawText: chunk.text, reason: "no_phone_found", lineNumber: chunk.lineNumber });
      }
      continue;
    }

    const phoneRaw = phoneMatch[0].trim();
    let rawName = withoutIndex
      .slice(0, phoneMatch.index)
      .trim()
      .replace(/[-–—_.:]+$/, "")
      .replace(/\s+/g, " ")
      .trim();

    const name = toTitleCase(rawName);

    if (!name) {
      skipped.push({ rawText: chunk.text, reason: "no_phone_found", lineNumber: chunk.lineNumber });
      continue;
    }

    const phoneCanonical = normalizeKePhone(phoneRaw);
    entries.push({ name, phoneRaw, phoneCanonical, lineNumber: chunk.lineNumber });
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
