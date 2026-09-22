"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKePhoneDisplay } from "@/lib/phone";
import { Input, Card } from "./ui";

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
      const { data } = await supabase
        .from("public_registrants")
        .select("id,name,phone_canonical")
        .or(`name.ilike.%${q}%,phone_canonical.ilike.%${q.replace(/\D/g, "")}%`)
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
      {loading && <p className="text-sm text-cream-100/50">Searching…</p>}
      {!loading && query.trim().length >= 2 && (
        <div className="space-y-2">
          {results.length === 0 && (
            <p className="text-sm text-cream-100/60">
              No match yet — you can add your details below.
            </p>
          )}
          {results.map((r) => (
            <Card key={r.id} className="flex items-center justify-between py-3">
              <span>{highlight(r.name, query)}</span>
              <span className="text-cream-100/60 text-sm">
                {highlight(formatKePhoneDisplay(r.phone_canonical), query.replace(/\D/g, ""))}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
