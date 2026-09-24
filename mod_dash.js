const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf-8');

// 1. Add import for syncMasterList
content = content.replace(
  /cleanAllNames,/,
  'cleanAllNames,\n  syncMasterList,\n  clearMissingFlag,'
);

// 2. Add state for showSync
content = content.replace(
  /const \[showImport, setShowImport\] = useState\(false\);/,
  'const [showImport, setShowImport] = useState(false);\n  const [showSync, setShowSync] = useState(false);'
);

// 3. Add button in header
content = content.replace(
  /<Button variant="ghost" onClick=\{\(\) => setShowImport\(\(v\) => !v\)\}>\s*Import list\s*<\/Button>/,
  `<Button variant="ghost" onClick={() => setShowImport((v) => !v)}>
            Import list
          </Button>
          <Button variant="ghost" onClick={() => setShowSync((v) => !v)}>
            Sync master list
          </Button>`
);

// 4. Render SyncPanel alongside ImportPanel
content = content.replace(
  /\{showImport && <ImportPanel onDone=\{onImportDone\} \/>\}/,
  `{showImport && <ImportPanel onDone={onImportDone} />}
      {showSync && <SyncPanel onDone={onImportDone} />}`
);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log('Modified AdminDashboard structure');
