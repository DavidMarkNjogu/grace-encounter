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
// Use [ \t] instead of \s so it doesn't cross newlines
const PHONE_RE = /(\+?254[ \t-]?\d[\d \t-]{6,12}\d|0\d[\d \t-]{6,10}\d)/g;
const SINGLE_PHONE_RE = /(\+?254[ \t-]?\d[\d \t-]{6,12}\d|0\d[\d \t-]{6,10}\d)/;

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
  
  // First, let's split the text into chunks by newlines, but filter out boilerplate
  const lines = cleaned.split(/\r?\n/);
  const validLines = [];
  
  for (let i = 0; i < lines.length; i++) {
     const l = lines[i].trim();
     if (!l) continue;
     if (BOILERPLATE_RE.test(l)) continue;
     validLines.push({ text: l, lineNumber: i + 1 });
  }

  // Now we need to split lines that contain MULTIPLE entries fused together
  // e.g. "682 .mayaka 0715791021 383. Shem 0701251561"
  const chunks: { text: string; lineNumber: number; isRealEntry: boolean }[] = [];

  for (const lineObj of validLines) {
    const text = lineObj.text;
    
    // If the line has multiple phone numbers, split it into chunks
    let lastIndex = 0;
    let match;
    // reset regex state
    PHONE_RE.lastIndex = 0;
    let matchCount = 0;
    
    while ((match = PHONE_RE.exec(text)) !== null) {
      matchCount++;
      const chunkText = text.substring(lastIndex, match.index + match[0].length);
      chunks.push({ text: chunkText.trim(), lineNumber: lineObj.lineNumber, isRealEntry: true });
      lastIndex = match.index + match[0].length;
    }
    
    // Any remaining text after the last phone number
    const remainder = text.substring(lastIndex).trim();
    if (remainder) {
       // If there were no phone numbers at all in this line, it's just a text chunk.
       // It could be a person without a phone number, or garbage.
       // If there WERE phone numbers, the remainder might be a person with NO phone number, 
       // but typically it's just trailing junk. We'll add it anyway and let the next logic decide.
       chunks.push({ text: remainder, lineNumber: lineObj.lineNumber, isRealEntry: true });
    }
  }

  const entries: ParsedEntry[] = [];
  const skipped: SkippedEntry[] = [];

  for (const chunk of chunks) {
    let originalListNumber: number | null = null;
    const numMatch = chunk.text.match(LIST_NUMBER_EXTRACT_RE);
    if (numMatch) {
      originalListNumber = parseInt(numMatch[1].replace(/O/i, "0"), 10);
    }

    // Instead of replacing ENTRY_BOUNDARY_RE which might destroy names if they start with a number
    // We already have cleanName which strips leading numbers correctly.
    const phoneMatch = chunk.text.match(SINGLE_PHONE_RE);

    if (!phoneMatch) {
      if (chunk.isRealEntry) {
        // Person without a phone number
        const name = cleanName(chunk.text);
        if (name && name.length > 2) {
           entries.push({ name, phoneRaw: "", phoneCanonical: null, lineNumber: chunk.lineNumber, originalListNumber });
        } else {
           skipped.push({ rawText: chunk.text, reason: "no_phone_found", lineNumber: chunk.lineNumber });
        }
      }
      continue;
    }

    const phoneRaw = phoneMatch[0].trim();
    const rawName = chunk.text.slice(0, phoneMatch.index).trim();

    // Apply the cleanName pipeline: strip residual numbers, trailing junk, Title Case
    const name = cleanName(rawName);

    if (!name || name.length < 2) {
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
      // If it doesn't have a phone, we still want to import it!
      // The user said: "Default: no phone in paste -> always treat as new/unmatched"
      // So they are inherently "unique" and not invalid!
      // wait, unique is constructed at the end.
      continue;
    }
    if (seen.has(entry.phoneCanonical)) {
      duplicatesWithinPaste.push(entry);
      continue;
    }
    seen.set(entry.phoneCanonical, entry);
  }
  
  // Add phoneless entries to the unique array
  const uniqueList = Array.from(seen.values());
  for (const entry of entries) {
    if (!entry.phoneCanonical) {
       uniqueList.push(entry);
    }
  }

  return { unique: uniqueList, invalidPhone, duplicatesWithinPaste };
}
