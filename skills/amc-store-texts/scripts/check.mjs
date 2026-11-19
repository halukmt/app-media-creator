#!/usr/bin/env node
// Checks the store texts in an app-media-creator job folder before the skill hands them over. No dependencies.
// Usage: node check.mjs "<job folder>"
// Exit code 0: no errors (warnings are printed). Exit code 1: errors to fix. Exit code 2: the folder cannot be read.
// The tool validates the files again when it reads them; this check only catches mistakes earlier.
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: node check.mjs "<job folder>"');
  process.exit(2);
}

function readJson(file) {
  try {
    const data = JSON.parse(readFileSync(path.join(folder, file), 'utf8'));
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? data : { error: `${file} must hold a JSON object` };
  } catch (error) {
    return { error: error.code === 'ENOENT' ? `${file} is missing` : `${file} is not valid JSON` };
  }
}

const brief = readJson('brief.json');
if (brief.error) {
  console.error(`${brief.error}: is this an app-media-creator job folder?`);
  process.exit(2);
}
if (!brief.storeTexts || !Array.isArray(brief.storeTexts.fields)) {
  console.error('brief.json has no storeTexts: this job is not a store texts job.');
  process.exit(2);
}

/** Every field the tool knows: the brief lists the store text catalogue (older briefs: this copy of it). */
const KNOWN_FIELDS = Array.isArray(brief.storeTextFields)
  ? brief.storeTextFields
  : ['apple-name', 'apple-subtitle', 'apple-promotional-text', 'apple-description', 'apple-keywords', 'apple-whats-new', 'google-title', 'google-short-description', 'google-full-description'];
// The tool's hard limit per file (MAX_STORE_TEXT); store limits per field are warnings.
const MAX_TEXT = 10_000;
const errors = [];
const warnings = [];

// Forbidden claims: the job's copy, plus the project's current list (the tool checks against the project).
const claims = readJson('claims.json');
const project = readJson(path.join('..', '..', 'project.json'));
if (claims.error) warnings.push(`${claims.error}: forbidden claims of the job are not checked`);
const forbidden = [
  ...new Set(
    [claims.forbidden, project.claims?.forbidden]
      .flatMap((list) => (Array.isArray(list) ? list : []))
      .filter((claim) => typeof claim === 'string' && claim.trim())
      .map((claim) => claim.trim()),
  ),
];

const fields = new Map(brief.storeTexts.fields.map((field) => [field.field, field]));
const locales = Array.isArray(brief.project?.locales) ? brief.project.locales : [];
const length = (spec, text) => (spec.unit === 'bytes' ? Buffer.byteLength(text, 'utf8') : [...text].length);

const root = path.join(folder, 'store-texts');
let entries;
try {
  if (!lstatSync(root).isDirectory()) throw Object.assign(new Error('not a folder'), { code: 'ENOTDIR' });
  entries = readdirSync(root, { withFileTypes: true });
} catch (error) {
  console.error(error.code === 'ENOENT' ? 'store-texts/ is missing: write the texts first' : 'store-texts must be a folder with one folder per language');
  process.exit(1);
}

const written = new Map();
for (const entry of entries) {
  if (!entry.isDirectory() || !locales.includes(entry.name)) {
    errors.push(`store-texts/${entry.name}: not a language folder of this job (${locales.join(', ')})`);
    continue;
  }
  const locale = entry.name;
  const texts = {};
  for (const file of readdirSync(path.join(root, locale))) {
    const where = `store-texts/${locale}/${file}`;
    const field = file.replace(/\.md$/, '');
    if (!file.endsWith('.md') || !KNOWN_FIELDS.includes(field)) {
      errors.push(`${where}: not a store text field (${KNOWN_FIELDS.join(', ')})`);
      continue;
    }
    const full = path.join(root, locale, file);
    if (!lstatSync(full).isFile()) {
      errors.push(`${where}: must be a regular file`);
      continue;
    }
    // Measured after trimming, as the tool stores the texts.
    const text = readFileSync(full, 'utf8').trim();
    if (!text) {
      errors.push(`${where}: empty`);
      continue;
    }
    if (text.length > MAX_TEXT) errors.push(`${where}: longer than ${MAX_TEXT} characters`);
    for (const claim of forbidden) {
      if (text.toLocaleLowerCase().includes(claim.toLocaleLowerCase())) errors.push(`${where}: uses the forbidden claim "${claim}"`);
    }
    texts[field] = text;
  }
  written.set(locale, texts);
}

for (const [locale, texts] of written) {
  for (const [field, text] of Object.entries(texts)) {
    const where = `store-texts/${locale}/${field}.md`;
    const spec = fields.get(field);
    if (!spec) {
      warnings.push(`${where}: not a field of the stores in this job`);
      continue;
    }
    const size = length(spec, text);
    if (size > spec.max) warnings.push(`${where}: ${spec.name} has ${size} ${spec.unit}; the store allows ${spec.max}`);
    if (!spec.multiline && text.includes('\n')) warnings.push(`${where}: ${spec.name} must be one line`);
    if (field === 'apple-keywords') {
      if (/,\s/.test(text)) warnings.push(`${where}: spaces after commas use up bytes; separate with commas only`);
      const list = text.split(',').map((keyword) => keyword.trim().toLocaleLowerCase(locale)).filter(Boolean);
      const twice = [...new Set(list.filter((keyword, index) => list.indexOf(keyword) !== index))];
      if (twice.length > 0) warnings.push(`${where}: listed twice: ${twice.join(', ')}`);
    }
    if (/!/.test(text) && !spec.multiline) warnings.push(`${where}: no exclamation marks in short fields`);
  }
  for (const spec of fields.values()) {
    if (spec.required && !texts[spec.field]) warnings.push(`store-texts/${locale}: ${spec.name} (${spec.field}) is required by the store and missing`);
  }
}
for (const locale of locales) {
  if (!written.has(locale)) warnings.push(`${locale}: no store texts for this language`);
}

for (const warning of warnings) console.log(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);
if (errors.length > 0) {
  console.error(`${errors.length} error(s): fix them and run the check again.`);
  process.exit(1);
}
console.log(`OK: the store texts are valid${warnings.length > 0 ? ` (${warnings.length} warning(s))` : ''}.`);
