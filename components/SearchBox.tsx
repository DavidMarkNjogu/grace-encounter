"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { maskKePhoneDisplay, toSearchDigits } from "@/lib/phone";
import { Input, ListRow } from "./ui";

interface Row {
  id: string;
  name: string;
  phone_canonical: string;
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-gold-500/40 text-cream-50 px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const qDigits = toSearchDigits(q);
      const orClause = qDigits
        ? `name.ilike.%${q}%,phone_canonical.ilike.%${qDigits}%`
        : `name.ilike.%${q}%`;
      const { data } = await supabase
        .from("public_registrants")
        .select("id,name,phone_canonical")
        .or(orClause)
        .limit(25);
      setResults(data ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, supabase]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search your name or phone number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search registration list"
      />
      {loading && <p className="text-sm text-cream-200">Searching…</p>}
      {!loading && query.trim().length >= 2 && (
        <div className="space-y-2">
          {results.length === 0 && (
            <p className="text-sm text-cream-200">
              No match yet — you can add your details below.
            </p>
          )}
          {results.map((r) => (
            <ListRow key={r.id} className="flex items-center justify-between">
              <span>{highlight(r.name, query)}</span>
              <span className="text-cream-200 text-sm">
                {maskKePhoneDisplay(r.phone_canonical)}
              </span>
            </ListRow>
          ))}
        </div>
      )}
    </div>
  );
}

