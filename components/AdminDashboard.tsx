"use client";
import { useEffect, useMemo, useState } from "react";
import { Users, Filter, MapPin, UploadCloud, ChevronLeft, ChevronRight, Trash2, Edit2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatKePhoneDisplay, toSearchDigits, normalizeKePhone } from "@/lib/phone";
import { parseRegistrationText, dedupeParsedEntries } from "@/lib/parse";
import { Button, Input, Card, StatusBadge } from "./ui";
import Wordmark from "./Wordmark";
import {
  updateStatus,
  updatePickupPoint,
  updateNote,
  bulkImport,
  addTeamMember,
  removeTeamMember,
  addPickupPoint,
  updateEventInfo,
  dismissPossibleDuplicate,
  removeRegistrant,
  cleanAllNames,
  syncMasterList,
  clearMissingFlag,
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
  missing_from_last_sync: boolean;
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
const ITEMS_PER_PAGE = 20;

export default function AdminDashboard({
  initialRegistrants,
  pickupPoints: initialPickupPoints,
  role,
  selfEmail,
  eventInfo,
  duplicates: initialDuplicates,
  teamMembers: initialTeamMembers,
}: {
  initialRegistrants: Registrant[];
  pickupPoints: PickupPoint[];
  role: "admin" | "caller";
  selfEmail: string;
  eventInfo: { venue_name: string | null; venue_lat: number | null; venue_lng: number | null; faq: { q: string; a: string }[] };
  duplicates: DuplicatePair[];
  teamMembers: any[];
}) {
  const [registrants, setRegistrants] = useState(initialRegistrants);
  const [pickupPoints, setPickupPoints] = useState(initialPickupPoints);
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [pickupFilter, setPickupFilter] = useState<string | "all">("all");
  const [numberingMode, setNumberingMode] = useState<"original" | "sequential">("original");
  const [showImport, setShowImport] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: 'list_number' | 'name' | 'created_at', direction: 'asc' | 'desc' }>({ key: 'list_number', direction: 'asc' });
  const ITEMS_PER_PAGE = 20;
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

  useEffect(() => { setCurrentPage(1); }, [query, statusFilter, pickupFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedRegistrants = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
          <Button variant="ghost" onClick={() => setShowSync((v) => !v)}>
            Sync master list
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
          {role === "admin" && (
            <Button 
              variant="ghost" 
              onClick={async () => { 
                if(window.confirm('Clean all names in the database? (Strips leading numbers, trailing junk, Title Cases)')) { 
                  const res = await cleanAllNames(); 
                  alert('Updated: ' + res.updated + ' | Errors: ' + res.errors); 
                  window.location.reload(); 
                } 
              }}
            >
              Clean Names
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
          teamMembers={teamMembers}
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

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
            className="flex h-10 items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm ring-offset-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by pickup point"
            value={pickupFilter}
            onChange={(e) => setPickupFilter(e.target.value)}
            className="flex h-10 items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm ring-offset-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
          >
            <option value="all">All pickup points</option>
            {pickupPoints.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Toggle numbering mode"
            value={numberingMode}
            onChange={(e) => setNumberingMode(e.target.value as "original" | "sequential")}
            className="flex h-10 items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm ring-offset-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
          >
            <option value="original">Original list #</option>
            <option value="sequential">Row count #</option>
          </select>
        </div>
      </Card>

            <div className="border border-line rounded-xl overflow-x-auto bg-surface shadow-md">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              <th 
                className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-primary transition-colors"
                onClick={() => setSortConfig(s => ({ key: 'list_number', direction: s.key === 'list_number' && s.direction === 'asc' ? 'desc' : 'asc' }))}
              >
                Ordered # {sortConfig.key === 'list_number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th 
                className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-primary transition-colors"
                onClick={() => setSortConfig(s => ({ key: 'name', direction: s.key === 'name' && s.direction === 'asc' ? 'desc' : 'asc' }))}
              >
                Name {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Phone</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Pickup Point</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Badge</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRegistrants.map((r, i) => (
              <RegistrantRow
                key={r.id}
                registrant={r}
                pickupPoints={pickupPoints}
                role={role}
                query={query}
                displayNumber={numberingMode === "sequential" ? (currentPage - 1) * ITEMS_PER_PAGE + i + 1 : r.list_number}
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
                onDelete={async () => {
                  setRegistrants((prev) => prev.filter((x) => x.id !== r.id));
                  await removeRegistrant(r.id, 'Deleted via Dashboard');
                }}
              />
            ))}
            {paginatedRegistrants.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-ink-soft">No registrants found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <p className="text-sm text-ink-soft">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} entries
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
            <Button variant="secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 flex flex-col justify-center border border-line shadow-sm bg-surface">
      <p className="text-3xl font-bold text-ink-900">{value}</p>
      <p className="text-xs text-ink-soft mt-1">{label}</p>
    </Card>
  );
}


function MissingPanel({ registrants }: { registrants: Registrant[] }) {
  const missing = registrants.filter(r => r.missing_from_last_sync);
  const [loading, setLoading] = useState<string | null>(null);

  if (missing.length === 0) return null;

  async function handleKeep(id: string) {
    setLoading(id);
    await clearMissingFlag(id);
    setLoading(null);
  }

  async function handleRemove(id: string) {
    if (!window.confirm('Are you sure you want to remove this person?')) return;
    setLoading(id);
    await removeRegistrant(id, 'Removed via master list sync');
    setLoading(null);
  }

  return (
    <Card className="mb-6 bg-surface-2 border-line p-5">
      <h2 className="mb-4 text-xl font-medium text-ink-900 flex items-center gap-2">
        <AlertCircle className="h-6 w-6 text-warn" />
        Missing from Master List ({missing.length})
      </h2>
      <p className="text-sm text-ink-soft mb-4">
        These people exist in the database but were not found in the latest WhatsApp paste. They may have been manually added as walk-ins, or the paste was incomplete.
      </p>
      <div className="space-y-2">
        {missing.map(r => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-line">
            <div>
              <p className="font-medium text-ink-900">{r.name}</p>
              <p className="text-xs text-ink-soft">{formatKePhoneDisplay(r.phone_canonical)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => handleKeep(r.id)} disabled={loading === r.id}>
                Keep anyway
              </Button>
              <Button variant="ghost" onClick={() => handleRemove(r.id)} disabled={loading === r.id}>
                Confirm removed
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}



function SyncPanel({ onDone }: { onDone: (r: any) => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<
    (ReturnType<typeof dedupeParsedEntries>) | null
  >(null);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);

  function runPreview() {
    const { entries } = parseRegistrationText(text);
    setPreview(dedupeParsedEntries(entries));
    setResult(null);
  }

  async function runSync() {
    if (!preview) return;
    setSyncing(true);
    const res = await syncMasterList(
      preview.unique.map((e) => ({ 
        name: e.name, 
        phoneRaw: e.phoneRaw,
        originalListNumber: e.originalListNumber 
      }))
    );
    setSyncing(false);
    setResult(res);
    onDone(res);
  }

  return (
    <Card className="mb-4 p-5 border-primary bg-surface-2 shadow-sm">
      <h2 className="mb-2 text-lg text-primary font-medium">Sync with Master List</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Paste the full WhatsApp list here. We will match everyone by phone number. 
        Existing people keep their status/van assignments. New people are added. 
        Anyone missing from this paste will be flagged for your review.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste the full WhatsApp list text here..."
        className="w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-primary"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={runPreview} disabled={!text.trim()}>
          Preview Sync
        </Button>
        {preview && (
          <Button onClick={runSync} disabled={syncing || preview.unique.length === 0}>
            {syncing ? "Syncing..." : "Run Sync on " + preview.unique.length + " entries"}
          </Button>
        )}
      </div>
      {result && (
        <div className="mt-4 bg-surface p-3 rounded-md text-sm border border-line">
          <strong>Sync complete!</strong> Inserted: {result.inserted}, Updated: {result.updated}, Flagged as missing: {result.missingFlagged}
        </div>
      )}
    </Card>
  );
}


function ImportPanel({ onDone }: { onDone: (r: any) => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<
    (ReturnType<typeof dedupeParsedEntries> & { skipped: import("@/lib/parse").SkippedEntry[] }) | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; duplicate: number; invalid: number } | null>(null);

  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewName, setReviewName] = useState("");
  const [reviewPhone, setReviewPhone] = useState("");

  const reviewItems = useMemo(() => {
    if (!preview) return [];
    return [
      ...preview.invalidPhone.map(p => ({ type: 'invalid', rawText: p.name + ' ' + p.phoneRaw, originalListNumber: p.originalListNumber, obj: p })),
      ...preview.skipped.map(s => ({ type: 'skipped', rawText: s.rawText, originalListNumber: null, obj: s }))
    ];
  }, [preview]);

  useEffect(() => {
    if (reviewMode && reviewIndex < reviewItems.length) {
      const item = reviewItems[reviewIndex];
      if (item.type === 'invalid') {
        setReviewName((item.obj as any).name || "");
        setReviewPhone((item.obj as any).phoneRaw || "");
      } else {
        // Pre-fill the skipped raw text so the user doesn't have to type from scratch
        setReviewName(item.rawText || "");
        setReviewPhone("");
      }
    } else if (reviewMode && reviewIndex >= reviewItems.length) {
      setReviewMode(false);
    }
  }, [reviewMode, reviewIndex, reviewItems]);

  function runPreview() {
    const { entries, skipped } = parseRegistrationText(text);
    setPreview({ ...dedupeParsedEntries(entries), skipped });
    setResult(null);
    setReviewMode(false);
    setReviewIndex(0);
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

  function resolveItem(save: boolean) {
    if (!preview) return;
    const item = reviewItems[reviewIndex];
    if (save && reviewName.trim() && reviewPhone.trim()) {
       setPreview(p => {
         if (!p) return p;
         return {
            ...p,
            unique: [...p.unique, {
               name: reviewName.trim(),
               phoneRaw: reviewPhone.trim(),
               phoneCanonical: normalizeKePhone(reviewPhone.trim()) || reviewPhone.trim(),
               lineNumber: (item.obj as any).lineNumber || 0,
               originalListNumber: item.originalListNumber
            }],
            invalidPhone: item.type === 'invalid' ? p.invalidPhone.filter(x => x !== item.obj) : p.invalidPhone,
            skipped: item.type === 'skipped' ? p.skipped.filter(x => x !== item.obj) : p.skipped
         };
       });
    }
    setReviewIndex(i => i + 1);
  }

  if (reviewMode && reviewIndex < reviewItems.length) {
    const item = reviewItems[reviewIndex];
    return (
      <Card className="mb-6 bg-surface-2 border-primary/30 p-5 shadow-lg">
        <h2 className="mb-4 text-xl font-medium text-primary flex items-center gap-2">
           <AlertCircle className="h-6 w-6" />
           Manual Review ({reviewIndex + 1} of {reviewItems.length})
        </h2>
        <div className="bg-surface p-4 rounded-md text-sm text-ink-soft mb-5 border border-line">
           <span className="text-ink opacity-50 mr-2 block mb-1 uppercase tracking-wider text-xs font-semibold">Raw Text Detected:</span>
           <span className="font-medium">{item.rawText}</span>
        </div>
        
        <div className="flex flex-col gap-4 mb-6">
           <div>
             <label className="text-xs font-medium text-ink-soft mb-1.5 block">Correct Name</label>
             <input value={reviewName} onChange={e => setReviewName(e.target.value)} className="w-full bg-surface border border-line px-3 py-2.5 rounded-md text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/50" placeholder="E.g. John Doe" />
           </div>
           <div>
             <label className="text-xs font-medium text-ink-soft mb-1.5 block">Correct Phone</label>
             <input value={reviewPhone} onChange={e => setReviewPhone(e.target.value)} className="w-full bg-surface border border-line px-3 py-2.5 rounded-md text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/50" placeholder="07xx xxx xxx" />
           </div>
        </div>

        <div className="flex gap-2 items-center">
           <Button onClick={() => resolveItem(true)}>Save & Next</Button>
           <Button variant="secondary" onClick={() => resolveItem(false)}>Skip</Button>
           <Button variant="ghost" disabled={reviewIndex === 0} onClick={() => setReviewIndex(i => Math.max(0, i - 1))} className="text-ink-soft">Previous</Button>
           <Button variant="ghost" onClick={() => setReviewMode(false)} className="ml-auto text-ink-soft">Close</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-4 p-5">
      <h2 className="mb-2 text-lg">Import from WhatsApp</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Paste one or more pasted message blocks below. We'll parse, normalize phone numbers,
        and skip anything already on the list.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste the WhatsApp list text here..."
        className="w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-primary"
      />
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" onClick={runPreview} disabled={!text.trim()}>
          Preview
        </Button>
        {preview && (
          <Button onClick={runImport} disabled={importing || preview.unique.length === 0}>
            {importing ? "Importing..." : "Import " + preview.unique.length + " new"}
          </Button>
        )}
      </div>
      {preview && (
        <div className="mt-3">
          <p className="text-sm text-ink-soft mb-2">
            Found {preview.unique.length} new, {preview.duplicatesWithinPaste.length} repeated
            within this paste.
          </p>
          {reviewItems.length > 0 && (
            <div className="bg-surface-2/40 p-3 rounded-lg border border-warn/20 text-sm">
              <div className="flex justify-between items-center mb-2">
                 <p className="text-warn font-medium">Needs Manual Review ({reviewItems.length})</p>
                 <Button variant="secondary" onClick={() => setReviewMode(true)} className="py-1 h-8 text-xs">Review Now</Button>
              </div>
              <p className="text-ink-soft text-xs">Some items couldn't be parsed automatically. Click review to fix them.</p>
            </div>
          )}
        </div>
      )}
      {result && (
        <p className="mt-2 text-sm text-ok-500">
          Imported {result.inserted} | already on list {result.duplicate} | invalid{" "}
          {result.invalid}
        </p>
      )}
    </Card>
  );
}
function TeamPanel({
  teamMembers,
  pickupPoints,
  onPickupAdded,
}: {
  teamMembers: any[];
  pickupPoints: PickupPoint[];
  onPickupAdded: (p: PickupPoint) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"caller" | "admin">("caller");
  const [msg, setMsg] = useState<string | null>(null);
  const [pointName, setPointName] = useState("");

  return (
    <Card className="mb-4 p-5 space-y-5">
      <div>
        <h2 className="mb-2 text-lg">Team members</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <Input
            placeholder="their@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "caller" | "admin")}
            className="flex h-10 items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm ring-offset-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
          >
            <option value="caller">Caller</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            onClick={async () => {
              const res = await addTeamMember(email, role);
              setMsg(res.error ? res.error : `Added ${email} as ${role}`);
              if (!res.error) {
                setEmail("");
                window.location.reload();
              }
            }}
          >
            Add
          </Button>
        </div>
        {msg && <p className="mb-4 text-sm text-ink-soft">{msg}</p>}

        <ul className="space-y-1 text-sm text-ink">
          {teamMembers.map((m) => (
            <li key={m.id} className="flex justify-between border-b border-line py-1">
              <span>{m.email} ({m.role})</span>
              <button 
                onClick={async () => {
                  if (window.confirm(`Remove ${m.email} from the team?`)) {
                    await removeTeamMember(m.id);
                    window.location.reload();
                  }
                }}
                className="text-red-400/80 hover:text-red-400 underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="mb-2 text-lg">Pickup points</h2>
        <p className="mb-2 text-sm text-ink-soft">
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
    <Card className="mb-4 p-5 space-y-4">
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
        <p className="mt-1 text-xs text-ink-soft">
          Leave lat/lng blank until the exact pin is confirmed — the public page shows
          "to be confirmed" until then.
        </p>
      </div>
      <div>
        <h2 className="mb-2 text-lg">FAQ</h2>
        <p className="mb-2 text-xs text-ink-soft">
          One entry per block, separated by a blank line, each as "Q: …" then "A: …".
        </p>
        <textarea
          value={faqText}
          onChange={(e) => setFaqText(e.target.value)}
          rows={10}
          className="w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-primary"
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
      {msg && <p className="text-sm text-ink-soft">{msg}</p>}
    </Card>
  );
}

function RegistrantRow({
  registrant: r,
  pickupPoints,
  role,
  onStatusChange,
  onPickupChange,
  onNoteChange,
  onDelete,
  query = "",
  displayNumber,
}: {
  registrant: Registrant;
  pickupPoints: PickupPoint[];
  role: "admin" | "caller";
  onStatusChange: (status: Status) => void;
  onPickupChange: (pickupPointId: string | null) => void;
  onNoteChange: (note: string) => void;
  onDelete: () => void;
  query?: string;
  displayNumber?: number | null;
}) {
  const [showNote, setShowNote] = useState(!!r.note);
  const [note, setNote] = useState(r.note ?? "");
  const numberToShow = displayNumber !== undefined ? displayNumber : r.list_number;

  return (
    <>
      <tr className="border-b border-line hover:bg-surface-2 transition-colors group">
        <td className="px-4 py-3 text-sm text-ink-soft whitespace-nowrap">{numberToShow !== null ? '#' + numberToShow : "-"}</td>
        <td className="px-4 py-3 text-sm font-medium text-ink-900">
          <Highlight text={r.name} query={query} />
        </td>
        <td className="px-4 py-3 text-sm text-ink-700 whitespace-nowrap">
          <Highlight text={formatKePhoneDisplay(r.phone_canonical)} query={query.replace(/\D/g, "")} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <select
            value={r.status}
            onChange={(e) => onStatusChange(e.target.value as Status)}
            className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-ink-800 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <select
            value={r.pickup_point_id ?? ""}
            onChange={(e) => onPickupChange(e.target.value || null)}
            className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-ink-800 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
          >
            <option value="">No pickup point</option>
            {pickupPoints.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <StatusBadge status={r.status} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-right">
          <div className="flex items-center justify-end gap-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setShowNote((v) => !v)}
              className="text-xs font-medium text-primary hover:text-primary-3 transition-colors"
            >
              {r.note ? "Edit Note" : "+ Add Note"}
            </button>
            {role === "admin" && (
              <button 
                type="button" 
                onClick={() => { if (window.confirm(`Are you sure you want to permanently delete ${r.name}?`)) { onDelete(); } }} 
                className="text-xs font-medium text-danger hover:text-danger-bg transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </td>
      </tr>
      {showNote && (
        <tr className="bg-bg border-b border-line">
          <td colSpan={7} className="px-4 py-3 pl-8">
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-soft uppercase tracking-wider font-semibold">Note:</span>
              <Input
                placeholder="e.g. confirming Friday, called twice no answer..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if (note !== (r.note ?? "")) onNoteChange(note);
                }}
                className="text-sm w-full max-w-2xl bg-surface border-line text-ink"
              />
            </div>
          </td>
        </tr>
      )}
    </>
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
    <Card className="mb-4 p-5">
      <h2 className="mb-1 text-lg">Possible duplicates</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Same or very similar name, different phone number — never auto-merged. Confirm each
        one: if they're genuinely different people, dismiss; if it's the same person under a
        second number, remove the extra entry.
      </p>
      {duplicates.length === 0 && (
        <p className="text-sm text-ink-soft">None right now.</p>
      )}
      <div className="border border-line rounded-xl overflow-hidden bg-surface-2 shadow-sm">
        {duplicates.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm"
          >
            <div>
              <p>
                <span className="font-medium">{d.name}</span>{" "}
                <span className="text-ink-soft">({formatKePhoneDisplay(d.phone_canonical)})</span>
              </p>
              <p className="text-ink-soft text-xs">
                looks like{" "}
                <span className="text-ink-soft">{d.matched_name}</span>{" "}
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
          <mark key={i} className="bg-primary-soft text-primary-3 px-0.5 rounded not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}




















