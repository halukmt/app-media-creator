// Checks that every UI component in src/web/components has a row in src/web/components/INVENTORY.md
// and that every row points to an existing file. Run: npm run check:inventory
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const COMPONENTS_DIR = path.join(ROOT, 'src', 'web', 'components');
const INVENTORY = path.join(COMPONENTS_DIR, 'INVENTORY.md');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Component files relative to the components folder (tests and helpers excluded). */
export function componentFiles(dir = COMPONENTS_DIR) {
  return walk(dir)
    .filter((file) => /\.tsx$/.test(file) && !/\.(test|spec)\.tsx$/.test(file))
    .map((file) => path.relative(dir, file).replace(/\\/g, '/'));
}

/** File names from the first column of the inventory table (`Name.tsx` or `sub/Name.tsx`). */
export function inventoryEntries(markdown) {
  const entries = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^\|\s*`([^`]+\.tsx)`\s*\|/.exec(line);
    if (match) entries.push(match[1]);
  }
  return entries;
}

export function checkInventory(files, entries) {
  const problems = [];
  for (const file of files) {
    if (!entries.includes(file)) problems.push(`${file}: missing in INVENTORY.md`);
  }
  for (const entry of entries) {
    if (!files.includes(entry)) problems.push(`INVENTORY.md lists ${entry}, but the file does not exist`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-inventory.mjs')) {
  if (!existsSync(INVENTORY)) {
    console.error('src/web/components/INVENTORY.md is missing');
    process.exit(1);
  }
  const problems = checkInventory(componentFiles(), inventoryEntries(readFileSync(INVENTORY, 'utf8')));
  if (problems.length > 0) {
    console.error(`Inventory check failed:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Inventory check passed');
}
