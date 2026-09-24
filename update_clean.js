const fs = require('fs');

const newCleanNameBody = `  let n = raw
    // Aggressively strip any leading digits, O's, dots, dashes, colons, spaces (e.g. "85.Chris", ".Sheila")
    .replace(/^[\\dO\\s.:)\\-]+/i, "")
    // Strip trailing dashes, dots, colons, underscores, commas
    .replace(/[\\s\\-\\u2013\\u2014_.:,;]+$/g, "")
    // Collapse whitespace
    .replace(/\\s+/g, " ")
    .trim();

  // Title Case: capitalize the first letter of each word and lowercase the rest
  n = n
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return n;`;

function updateFile(path) {
  let content = fs.readFileSync(path, 'utf-8');
  content = content.replace(
    /function cleanName\(raw: string\): string \{[\s\S]*?return n;\n\s*\}/,
    `function cleanName(raw: string): string {\n${newCleanNameBody}\n}`
  );
  fs.writeFileSync(path, content);
}

updateFile('lib/parse.ts');
updateFile('app/admin/actions.ts');
console.log('done');
