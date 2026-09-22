"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKePhoneDisplay } from "@/lib/phone";
import { parseRegistrationText, dedupeParsedEntries } from "@/lib/parse";
import { Button, Input, Card, StatusBadge } from "./ui";
import {
  updateStatus,
  updatePickupPoint,
  bulkImport,
  addTeamMember,
  addPickupPoint,
} from "@/app/admin/actions";

type Status = "not_called" | "pending" | "confirmed" | "tentative";

interface Registrant {
  id: string;
  name: string;
  phone_canonical: string;
  status: Status;
  pickup_point_id: string | null;
  source: string;
  list_number: number;
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
}: {
  initialRegistrants: Registrant[];
  pickupPoints: PickupPoint[];
  role: "admin" | "caller";
  selfEmail: string;
}) {
  const [registrants, setRegistrants] = useState(initialRegistrants);
  const [pickupPoints, setPickupPoints] = useState(initialPickupPoints);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [pickupFilter, setPickupFilter] = useState<string | "all">("all");
  const [showImport, setShowImport] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
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
      if (!r.name.toLowerCase().includes(q) && !phone.includes(q.replace(/\D/g, ""))) return false;
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
          <p className="text-gold-400 text-xs tracking-[0.2em] uppercase mb-1">
            Grace Encounter · Admin
          </p>
          <h1 className="text-2xl font-medium">Registration desk</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowImport((v) => !v)}>
            Import list
          </Button>
          {role === "admin" && (
            <Button variant="ghost" onClick={() => setShowTeam((v) => !v)}>
              Team
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
          onDone={(result) => {
            setShowImport(false);
          }}
        />
      )}

      {showTeam && role === "admin" && (
        <TeamPanel
          pickupPoints={pickupPoints}
          onPickupAdded={(p) => setPickupPoints((prev) => [...prev, p])}
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
        </div>
      </Card>

      <div className="space-y-2">
        {filtered.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-[160px] flex-1">
              <p className="font-medium">
                {r.list_number && <span className="text-cream-100/40 mr-2">#{r.list_number}</span>}
                {r.name}
              </p>
              <p className="text-xs text-cream-100/50">
                {formatKePhoneDisplay(r.phone_canonical)}
              </p>
            </div>
            <select
              value={r.status}
              onChange={async (e) => {
                const status = e.target.value as Status;
                setRegistrants((prev) =>
                  prev.map((x) => (x.id === r.id ? { ...x, status } : x))
                );
                await updateStatus(r.id, status);
              }}
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
              onChange={async (e) => {
                const val = e.target.value || null;
                setRegistrants((prev) =>
                  prev.map((x) => (x.id === r.id ? { ...x, pickup_point_id: val } : x))
                );
                await updatePickupPoint(r.id, val);
              }}
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
          </Card>
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
    (ReturnType<typeof dedupeParsedEntries> & { skippedCount: number }) | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; duplicate: number; invalid: number } | null>(
    null
  );

  function runPreview() {
    const { entries, skipped } = parseRegistrationText(text);
    setPreview({ ...dedupeParsedEntries(entries), skippedCount: skipped.length });
    setResult(null);
  }

  async function runImport() {
    if (!preview) return;
    setImporting(true);
    const res = await bulkImport(
      preview.unique.map((e) => ({ name: e.name, phoneRaw: e.phoneRaw }))
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
        <p className="mt-3 text-sm text-cream-100/60">
          Found {preview.unique.length} new, {preview.duplicatesWithinPaste.length} repeated
          within this paste, {preview.invalidPhone.length} with unreadable phone numbers,{" "}
          {preview.skippedCount} lines skipped (no phone found — check manually).
        </p>
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
    </Card>

    <Card className="mb-4 space-y-5">
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
