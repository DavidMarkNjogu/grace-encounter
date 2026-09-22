// Mirrors normalize_ke_phone() in supabase/schema.sql — kept identical so
// client-side preview (e.g. "you're a duplicate") matches server truth.

export function normalizeKePhone(raw: string): string | null {
  if (!raw) return null;
  if (/[A-Za-z]/.test(raw)) return null; // a real phone number never contains a letter
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  let national: string | null = null;
  if (digits.length === 12 && digits.startsWith("254")) national = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  if (!national) return null;

  // Real Kenyan mobile ranges only: 07xxxxxxxx (all networks) or 011xxxxxxx
  // (Telkom/Faiba/Equitel) — mirrors normalize_ke_phone() in schema.sql.
  if (national.startsWith("7") || national.startsWith("11")) return "254" + national;
  return null;
}

export function formatKePhoneDisplay(canonical: string): string {
  // 2547XXXXXXXX -> 07XX XXX XXX
  if (canonical.length === 12 && canonical.startsWith("254")) {
    const local = "0" + canonical.slice(3);
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return canonical;
}

// Turns whatever digits the user is typing into the same 254-prefixed shape
// phone_canonical uses, so a partial search ("0712", "712", "254712") all
// match consistently — even mid-keystroke, before the number is complete.
export function toSearchDigits(query: string): string {
  const digits = query.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) {
    const rest = digits.slice(1);
    return rest ? "254" + rest : ""; // "0" alone is not a meaningful phone query
  }
  if (digits === "254") return "";
  if (/^[71]/.test(digits)) return "254" + digits;
  return digits;
}

export function maskKePhoneDisplay(canonical: string): string {
  const full = formatKePhoneDisplay(canonical);
  const parts = full.split(" ");
  if (parts.length !== 3) return full;
  return `${parts[0]} \u2022\u2022\u2022 ${parts[2]}`;
}
