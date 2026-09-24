const fs = require('fs');

let content = fs.readFileSync('app/admin/actions.ts', 'utf-8');

if (!content.includes('normalizeKePhone')) {
  content = content.replace(
    /import \{ revalidatePath \} from "next\/cache";/,
    'import { revalidatePath } from "next/cache";\nimport { normalizeKePhone } from "@/lib/phone";'
  );
}

const appendCode = fs.readFileSync('script_actions.js', 'utf-8');
const splitPoint = 'export async function clearMissingFlag';
const functionsToAppend = appendCode.split(splitPoint)[1];

content = content + '\n\n' + splitPoint + functionsToAppend;

fs.writeFileSync('app/admin/actions.ts', content);
console.log('actions.ts updated');
