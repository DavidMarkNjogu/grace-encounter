const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf-8');

const missingPanelStr = `
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
              <p className="text-xs text-ink-soft">{r.phone}</p>
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
`;

const syncPanelStr = `
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
`;

content = content.replace(
  /function ImportPanel/,
  missingPanelStr + '\n\n' + syncPanelStr + '\n\nfunction ImportPanel'
);

content = content.replace(
  /<div className="rounded-xl border border-line bg-surface-2 text-sm shadow-sm overflow-hidden">/,
  '<MissingPanel registrants={registrants} />\n      <div className="rounded-xl border border-line bg-surface-2 text-sm shadow-sm overflow-hidden">'
);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log('Added MissingPanel and SyncPanel');
