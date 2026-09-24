const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// 1. Add sorting state
const stateHook = 'const [currentPage, setCurrentPage] = useState(1);';
const newStates = `const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: 'list_number' | 'name' | 'created_at', direction: 'asc' | 'desc' }>({ key: 'list_number', direction: 'asc' });`;
code = code.replace(stateHook, newStates);

// 2. Add sorting logic to filtered
const filteredOld = `  const filtered = registrants.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (pickupFilter !== "all" && r.pickup_point_id !== pickupFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const phone = r.phone_canonical.toLowerCase();
      const qDigits = toSearchDigits(q);
      if (!r.name.toLowerCase().includes(q) && !(qDigits && phone.includes(qDigits))) return false;
    }
    return true;
  });`;

const filteredNew = `  const filtered = registrants.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (pickupFilter !== "all" && r.pickup_point_id !== pickupFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const phone = r.phone_canonical.toLowerCase();
      const qDigits = toSearchDigits(q);
      if (!r.name.toLowerCase().includes(q) && !(qDigits && phone.includes(qDigits))) return false;
    }
    return true;
  }).sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    if (aVal === null || aVal === undefined) aVal = sortConfig.direction === 'asc' ? Infinity : -Infinity;
    if (bVal === null || bVal === undefined) bVal = sortConfig.direction === 'asc' ? Infinity : -Infinity;
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });`;
code = code.replace(filteredOld, filteredNew);

// 3. Update the table headers to be clickable
const theadOld = `          <thead>
            <tr className="border-b border-line bg-surface-2">
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Ordered #</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Name</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Phone</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Pickup Point</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">Badge</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>`;

const theadNew = `          <thead>
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
          </thead>`;

code = code.replace(theadOld, theadNew);

fs.writeFileSync('components/AdminDashboard.tsx', code, 'utf8');
console.log('Added sorting to table');
