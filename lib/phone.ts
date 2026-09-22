// Mirrors normalize_ke_phone() in supabase/schema.sql — kept identical so
// client-side preview (e.g. "you're a duplicate") matches server truth.

export function normalizeKePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 12 && digits.startsWith("254")) return digits;
  if (digits.length === 10 && digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.length === 9 && /^[71]/.test(digits)) return "254" + digits;

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
