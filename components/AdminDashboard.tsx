"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKePhoneDisplay, toSearchDigits } from "@/lib/phone";
import { parseRegistrationText, dedupeParsedEntries } from "@/lib/parse";
import { Button, Input, Card, StatusBadge } from "./ui";
import Wordmark from "./Wordmark";
import {
  updateStatus,
  updatePickupPoint,
  updateNote,
  bulkImport,
  addTeamMember,
  addPickupPoint,
  updateEventInfo,
  dismissPossibleDuplicate,
  removeRegistrant,
} from "@/app/admin/actions";

type Status = "not_called" | "pending" | "confirmed" | "tentative";

interface Registrant {
  id: string;
  name: string;
  phone_canonical: string;
  status: Status;
  pickup_point_id: string | null;
  source: string;
  note: string | null;
  list_number: number | null;
}

interface DuplicatePair {
  id: string;
  name: string;
  phone_canonical: string;
  matched_id: string;
  matched_name: string;
  matched_phone: string;
}

interface PickupPoint {
  id: string;
  name: string;
}

const STATUS_OPTIONS: Status[] = ["not_called", "pending", "confirmed", "tentative"];

export default function AdminDashboard({
  initialRegistrants,
  pickupPoints: initialPickupPoints,
  role,
  selfEmail,
  eventInfo,
  duplicates: initialDuplicates,
}: {
  initialRegistrants: Registrant[];
  pickupPoints: PickupPoint[];
  role: "admin" | "caller";
  selfEmail: string;
  eventInfo: { venue_name: string | null; venue_lat: number | null; venue_lng: number | null; faq: { q: string; a: string }[] };
  duplicates: DuplicatePair[];
}) {
  const [registrants, setRegistrants] = useState(initialRegistrants);
  const [pickupPoints, setPickupPoints] = useState(initialPickupPoints);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [pickupFilter, setPickupFilter] = useState<string | "all">("all");
  const [numberingMode, setNumberingMode] = useState<"original" | "sequential">("original");
  const [showImport, setShowImport] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showEventInfo, setShowEventInfo] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState(initialDuplicates);
  const supabase = useMemo(() => createClient(), []);

  // Live sync: reflect edits from other admins in real time.
  useEffect(() => {
    const channel = supabase
      .channel("registrants-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registrants" },
        (payload) => {
          setRegistrants((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as Registrant, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((r) => r.id !== payload.old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filtered = registrants.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (pickupFilter !== "all" && r.pickup_point_id !== pickupFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const phone = r.phone_canonical.toLowerCase();
      const qDigits = toSearchDigits(q);
      if (!r.name.toLowerCase().includes(q) && !(qDigits && phone.includes(qDigits))) return false;
    }
    return true;
  });

  const counts = useMemo(() => {
    const base: Record<string, number> = { total: registrants.length };
    for (const s of STATUS_OPTIONS) base[s] = registrants.filter((r) => r.status === s).length;
    return base;
  }, [registrants]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Wordmark />
          <h1 className="mt-2 text-2xl font-medium">Registration desk</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setShowImport((v) => !v)}>
            Import list
          </Button>
          <Button variant="ghost" onClick={() => setShowDuplicates((v) => !v)}>
            Duplicates{duplicates.length > 0 ? ` (${duplicates.length})` : ""}
          </Button>
          <Button variant="ghost" onClick={() => exportCsv(registrants, pickupPoints)}>
            Export CSV
          </Button>
          {role === "admin" && (
            <Button variant="ghost" onClick={() => setShowTeam((v) => !v)}>
              Team
            </Button>
          )}
          {role === "admin" && (
            <Button variant="ghost" onClick={() => setShowEventInfo((v) => !v)}>
              FAQ &amp; venue
            </Button>
          )}
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Not called" value={counts.not_called} />
        <StatCard label="Pending" value={counts.pending} />
        <StatCard label="Confirmed" value={counts.confirmed} />
        <StatCard label="Tentative" value={counts.tentative} />
      </div>

      {showImport && (
        <ImportPanel
          onDone={async () => {
            setShowImport(false);
            const { data } = await supabase
              .from("registrants")
              .select("*")
              .order("created_at", { ascending: false });
            if (data) setRegistrants(data as Registrant[]);
          }}
        />
      )}

      {showTeam && role === "admin" && (
        <TeamPanel
          pickupPoints={pickupPoints}
          onPickupAdded={(p) => setPickupPoints((prev) => [...prev, p])}
        />
      )}

      {showEventInfo && role === "admin" && <EventInfoPanel initial={eventInfo} />}

      {showDuplicates && (
        <DuplicatesPanel
          duplicates={duplicates}
          onResolved={(id) => setDuplicates((prev) => prev.filter((d) => d.id !== id))}
        />
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
            className="rounded-xl border border-cream-100/15 bg-ink-900/60 px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            value={pickupFilter}
            onChange={(e) => setPickupFilter(e.target.value)}
            className="rounded-xl border border-cream-100/15 bg-ink-900/60 px-3 py-2 text-sm"
          >
            <option value="all">All pickup points</option>
            {pickupPoints.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={numberingMode}
            onChange={(e) => setNumberingMode(e.target.value as "original" | "sequential")}
            className="rounded-xl border border-cream-100/15 bg-ink-900/60 px-3 py-2 text-sm"
          >
            <option value="original">Original list #</option>
            <option value="sequential">Row count #</option>
          </select>
        </div>
      </Card>

      <div className="space-y-2">
        {filtered.map((r, i) => (
          <RegistrantRow
            key={r.id}
            registrant={r}
            pickupPoints={pickupPoints}
            query={query}
            displayNumber={numberingMode === "sequential" ? i + 1 : r.list_number}
            onStatusChange={async (status) => {
              setRegistrants((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
              await updateStatus(r.id, status);
            }}
            onPickupChange={async (val) => {
              setRegistrants((prev) =>
                prev.map((x) => (x.id === r.id ? { ...x, pickup_point_id: val } : x))
              );
              await updatePickupPoint(r.id, val);
            }}
            onNoteChange={async (note) => {
              setRegistrants((prev) => prev.map((x) => (x.id === r.id ? { ...x, note } : x)));
              await updateNote(r.id, note);
            }}
          />
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-cream-100/40 text-sm">No matching registrants.</p>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-2xl font-medium text-gold-400">{value}</p>
      <p className="text-xs text-cream-100/50 mt-1">{label}</p>
    </Card>
  );
}

function ImportPanel({ onDone }: { onDone: (r: any) => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<
    (ReturnType<typeof dedupeParsedEntries> & { skipped: import("@/lib/parse").SkippedEntry[] }) | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; duplicate: number; invalid: number } | null>(
    null
  );

  function runPreview() {
    const { entries, skipped } = parseRegistrationText(text);
    setPreview({ ...dedupeParsedEntries(entries), skipped });
    setResult(null);
  }

  async function runImport() {
    if (!preview) return;
    setImporting(true);
    const res = await bulkImport(
      preview.unique.map((e) => ({ 
        name: e.name, 
        phoneRaw: e.phoneRaw,
        originalListNumber: e.originalListNumber 
      }))
    );
    setImporting(false);
    setResult(res);
    onDone(res);
  }

  return (
    <Card className="mb-4">
      <h2 className="mb-2 text-lg">Import from WhatsApp</h2>
      <p className="mb-3 text-sm text-cream-100/50">
        Paste one or more pasted message blocks below. We'll parse, normalize phone numbers,
        and skip anything already on the list.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste the WhatsApp list text here…"
        className="w-full rounded-xl border border-cream-100/15 bg-ink-900/60 p-3 text-sm outline-none focus:border-gold-500"
      />
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" onClick={runPreview} disabled={!text.trim()}>
          Preview
        </Button>
        {preview && (
          <Button onClick={runImport} disabled={importing || preview.unique.length === 0}>
            {importing ? "Importing…" : `Import ${preview.unique.length} new`}
          </Button>
        )}
      </div>
      {preview && (
        <div className="mt-3">
          <p className="text-sm text-cream-100/60 mb-2">
            Found {preview.unique.length} new, {preview.duplicatesWithinPaste.length} repeated
            within this paste.
          </p>
          {(preview.invalidPhone.length > 0 || preview.skipped.length > 0) && (
            <div className="bg-ink-900/40 p-3 rounded-lg border border-warning-500/20 text-sm">
              <p className="text-warning-400 font-medium mb-2">Needs Manual Review:</p>
              {preview.invalidPhone.length > 0 && (
                <div className="mb-2">
                  <span className="text-cream-100/80">Unreadable phone numbers ({preview.invalidPhone.length}):</span>
                  <ul className="list-disc pl-5 text-cream-100/50 mt-1">
                    {preview.invalidPhone.map((e, i) => <li key={i}>{e.name} - {e.phoneRaw}</li>)}
                  </ul>
                </div>
              )}
              {preview.skipped.length > 0 && (
                <div>
                  <span className="text-cream-100/80">Skipped lines (no phone found) ({preview.skipped.length}):</span>
                  <ul className="list-disc pl-5 text-cream-100/50 mt-1">
                    {preview.skipped.map((s, i) => <li key={i}><span className="text-cream-100/30 mr-1">L{s.lineNumber}</span>{s.rawText}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {result && (
        <p className="mt-2 text-sm text-ok-500">
          Imported {result.inserted} · already on list {result.duplicate} · invalid{" "}
          {result.invalid}
        </p>
      )}
    </Card>
  );
}

function TeamPanel({
  pickupPoints,
  onPickupAdded,
}: {
  pickupPoints: PickupPoint[];
  onPickupAdded: (p: PickupPoint) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"caller" | "admin">("caller");
  const [msg, setMsg] = useState<string | null>(null);
  const [pointName, setPointName] = useState("");

  return (
    <Card className="mb-4 space-y-5">
      <div>
        <h2 className="mb-2 text-lg">Add a team member</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="their@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "caller" | "admin")}
            className="rounded-xl border border-cream-100/15 bg-ink-900/60 px-3 py-2 text-sm"
          >
            <option value="caller">Caller</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            onClick={async () => {
              const res = await addTeamMember(email, role);
              setMsg(res.error ? res.error : `Added ${email} as ${role}`);
              if (!res.error) setEmail("");
            }}
          >
            Add
          </Button>
        </div>
        {msg && <p className="mt-2 text-sm text-cream-100/60">{msg}</p>}
      </div>
      <div>
        <h2 className="mb-2 text-lg">Pickup points</h2>
        <p className="mb-2 text-sm text-cream-100/50">
          {pickupPoints.map((p) => p.name).join(" · ") || "None yet"}
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="New pickup point name"
            value={pointName}
            onChange={(e) => setPointName(e.target.value)}
          />
          <Button
            onClick={async () => {
              await addPickupPoint(pointName);
              onPickupAdded({ id: crypto.randomUUID(), name: pointName });
              setPointName("");
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
}


function EventInfoPanel({
  initial,
}: {
  initial: { venue_name: string | null; venue_lat: number | null; venue_lng: number | null; faq: { q: string; a: string }[] };
}) {
  const [venueName, setVenueName] = useState(initial.venue_name ?? "");
  const [lat, setLat] = useState(initial.venue_lat?.toString() ?? "");
  const [lng, setLng] = useState(initial.venue_lng?.toString() ?? "");
  const [faqText, setFaqText] = useState(
    initial.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function parseFaq(text: string) {
    const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    const items: { q: string; a: string }[] = [];
    for (const block of blocks) {
      const qMatch = block.match(/^Q:\s*(.+)/im);
      const aMatch = block.match(/^A:\s*([\s\S]+)/im);
      if (qMatch && aMatch) items.push({ q: qMatch[1].trim(), a: aMatch[1].trim() });
    }
    return items;
  }

  return (
    <Card className="mb-4 space-y-4">
      <div>
        <h2 className="mb-2 text-lg">Venue</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Venue name (e.g. Uhuru Park, Nairobi)"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Input
            placeholder="Latitude (optional)"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Longitude (optional)"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="w-40"
          />
        </div>
        <p className="mt-1 text-xs text-cream-100/40">
          Leave lat/lng blank until the exact pin is confirmed — the public page shows
          "to be confirmed" until then.
        </p>
      </div>
      <div>
        <h2 className="mb-2 text-lg">FAQ</h2>
        <p className="mb-2 text-xs text-cream-100/40">
          One entry per block, separated by a blank line, each as "Q: …" then "A: …".
        </p>
        <textarea
          value={faqText}
          onChange={(e) => setFaqText(e.target.value)}
          rows={10}
          className="w-full rounded-xl border border-cream-100/15 bg-ink-900/60 p-3 text-sm outline-none focus:border-gold-500"
        />
      </div>
      <Button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          const res = await updateEventInfo(
            venueName || null as any,
            lat ? parseFloat(lat) : null,
            lng ? parseFloat(lng) : null,
            parseFaq(faqText)
          );
          setSaving(false);
          setMsg(res.error ? res.error : "Saved — live on the public page now.");
        }}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
      {msg && <p className="text-sm text-cream-100/60">{msg}</p>}
    </Card>
  );
}

function RegistrantRow({
  registrant: r,
  pickupPoints,
  onStatusChange,
  onPickupChange,
  onNoteChange,
  query = "",
  displayNumber,
}: {
  registrant: Registrant;
  pickupPoints: PickupPoint[];
  onStatusChange: (status: Status) => void;
  onPickupChange: (pickupPointId: string | null) => void;
  onNoteChange: (note: string) => void;
  query?: string;
  displayNumber?: number | null;
}) {
  const [showNote, setShowNote] = useState(!!r.note);
  const [note, setNote] = useState(r.note ?? "");
  const numberToShow = displayNumber !== undefined ? displayNumber : r.list_number;

  return (
    <Card className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[160px] flex-1">
          <p className="font-medium">
            {numberToShow !== null && <span className="text-cream-100/40 mr-2">#{numberToShow}</span>}
            <Highlight text={r.name} query={query} />
          </p>
          <p className="text-xs text-cream-100/50">
            <Highlight text={formatKePhoneDisplay(r.phone_canonical)} query={query.replace(/\D/g, "")} />
          </p>
        </div>
        <select
          value={r.status}
          onChange={(e) => onStatusChange(e.target.value as Status)}
          className="rounded-full border border-cream-100/15 bg-ink-900/60 px-3 py-1.5 text-xs"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={r.pickup_point_id ?? ""}
          onChange={(e) => onPickupChange(e.target.value || null)}
          className="rounded-full border border-cream-100/15 bg-ink-900/60 px-3 py-1.5 text-xs"
        >
          <option value="">No pickup point</option>
          {pickupPoints.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <StatusBadge status={r.status} />
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className="text-xs text-cream-100/40 underline hover:text-cream-100/70"
        >
          {r.note ? "Note" : "+ note"}
        </button>
      </div>
      {showNote && (
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="e.g. confirming Friday, called twice no answer…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (r.note ?? "")) onNoteChange(note);
            }}
            className="text-xs"
          />
        </div>
      )}
    </Card>
  );
}

function DuplicatesPanel({
  duplicates,
  onResolved,
}: {
  duplicates: DuplicatePair[];
  onResolved: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <Card className="mb-4">
      <h2 className="mb-1 text-lg">Possible duplicates</h2>
      <p className="mb-3 text-sm text-cream-100/50">
        Same or very similar name, different phone number — never auto-merged. Confirm each
        one: if they're genuinely different people, dismiss; if it's the same person under a
        second number, remove the extra entry.
      </p>
      {duplicates.length === 0 && (
        <p className="text-sm text-cream-100/40">None right now.</p>
      )}
      <div className="space-y-2">
        {duplicates.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-100/10 p-3 text-sm"
          >
            <div>
              <p>
                <span className="font-medium">{d.name}</span>{" "}
                <span className="text-cream-100/50">({formatKePhoneDisplay(d.phone_canonical)})</span>
              </p>
              <p className="text-cream-100/40 text-xs">
                looks like{" "}
                <span className="text-cream-100/60">{d.matched_name}</span>{" "}
                ({formatKePhoneDisplay(d.matched_phone)})
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={busy === d.id}
                onClick={async () => {
                  setBusy(d.id);
                  await dismissPossibleDuplicate(d.id);
                  setBusy(null);
                  onResolved(d.id);
                }}
              >
                Not a duplicate
              </Button>
              <Button
                disabled={busy === d.id}
                onClick={async () => {
                  setBusy(d.id);
                  await removeRegistrant(d.id, "confirmed duplicate of " + d.matched_id);
                  setBusy(null);
                  onResolved(d.id);
                }}
              >
                Remove this entry
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function exportCsv(registrants: Registrant[], pickupPoints: PickupPoint[]) {
  const pointName = (id: string | null) => pickupPoints.find((p) => p.id === id)?.name ?? "";
  const header = ["Name", "Phone", "Status", "Pickup point", "Note"];
  const rows = registrants.map((r) => [
    r.name,
    formatKePhoneDisplay(r.phone_canonical),
    r.status,
    pointName(r.pickup_point_id),
    r.note ?? "",
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `grace-encounter-registrants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const q = query.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-gold-500/40 text-gold-200 px-0.5 rounded not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
