import re

with open('components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

new_row = r"""function RegistrantRow({
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
            className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-ink-800 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
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
            className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-ink-800 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
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
                onClick={() => { if (window.confirm(Are you sure you want to permanently delete ?)) { onDelete(); } }} 
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
}"""

# Using lambda to prevent escape evaluation
code = re.sub(r'function RegistrantRow\(\{[\s\S]*?\n\}\n', lambda x: new_row + '\n', code)

new_map = r"""      <div className="border border-line rounded-xl overflow-x-auto bg-surface shadow-md">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Ordered #</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Name</th>
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
                  await removeRegistrant(r.id);
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
      </div>"""

code = re.sub(r'<div className="border border-ink-800 rounded-xl overflow-hidden bg-ink-900 shadow-sm">\s*\{paginatedRegistrants.*?No registrants found\.</div>\s*\)\}\s*</div>', lambda x: new_map, code, flags=re.DOTALL)

code = code.replace('bg-ink-950', 'bg-surface')
code = code.replace('bg-ink-900', 'bg-surface-2')
code = code.replace('border-ink-800', 'border-line')
code = code.replace('text-cream-50', 'text-ink-900')
code = code.replace('text-cream-200', 'text-ink-soft')
code = code.replace('text-cream-100', 'text-ink')

with open('components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
