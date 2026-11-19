#!/usr/bin/env node
// Checks headlines.json in an app-media-creator job folder before the skill hands it over. No dependencies.
// Usage: node check.mjs "<job folder>"
// Exit code 0: no errors (warnings are printed). Exit code 1: errors to fix. Exit code 2: the folder cannot be read.
// The tool validates the file again when it reads it; this check only catches mistakes earlier.
import { readFileSync } from 'node:fs';
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
const errors = [];
const warnings = [];
// Forbidden claims: the job's copy, plus the project's current list (the tool checks against the project when it
// reads the result, so a claim forbidden after the job was prepared counts too).
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
const result = readJson('headlines.json');
if (result.error) {
  console.error(result.error);
  process.exit(1);
}

const MAX_TEXT = 200;
const MAX_SLOTS = 10;
const locales = brief.project?.locales ?? [];

if (result.version !== 1) errors.push('version must be 1');
if (typeof result.locales !== 'object' || result.locales === null || Array.isArray(result.locales)) {
  errors.push('locales must be an object with one entry per language');
} else {
  for (const [locale, entry] of Object.entries(result.locales)) {
    if (!locales.includes(locale)) {
      errors.push(`${locale} is not a language of this job (${locales.join(', ')})`);
      continue;
    }
    const slots = Array.isArray(entry?.slots) ? entry.slots : null;
    if (!slots || slots.length === 0) {
      errors.push(`${locale}: slots must be a non-empty list`);
      continue;
    }
    if (slots.length > MAX_SLOTS) errors.push(`${locale}: at most ${MAX_SLOTS} slots`);
    const briefSlots = brief.screenshots?.[locale] ?? [];
    const byInput = new Map(briefSlots.map((slot) => [slot.input, slot]));
    const seen = new Set();
    for (const [index, slot] of slots.entries()) {
      const where = `${locale} slot ${index + 1}`;
      const known = byInput.get(slot?.input);
      if (!known) errors.push(`${where}: input "${slot?.input}" is not a screenshot of this language in brief.json`);
      if (seen.has(slot?.input)) errors.push(`${where}: input "${slot?.input}" is listed twice`);
      seen.add(slot?.input);
      const limits = known?.limits ?? { headline: 30, subline: 40 };
      const slotLabel = `${locale} slot ${known?.slot ?? index + 1}`;
      for (const variant of ['A', 'B']) {
        const text = slot?.[variant];
        const label = `${slotLabel} ${variant}`;
        if (typeof text?.headline !== 'string' || !text.headline.trim()) {
          errors.push(`${label}: headline is required`);
          continue;
        }
        if (text.subline !== undefined && typeof text.subline !== 'string') errors.push(`${label}: subline must be text`);
        // Measured after trimming, as the tool stores the texts.
        const headline = text.headline.trim();
        const subline = typeof text.subline === 'string' ? text.subline.trim() : '';
        if (headline.length > MAX_TEXT || subline.length > MAX_TEXT) errors.push(`${label}: at most ${MAX_TEXT} characters`);
        if (headline.length > limits.headline) warnings.push(`${label}: headline has ${headline.length} characters (recommended ${limits.headline})`);
        if (subline.length > limits.subline) warnings.push(`${label}: subline has ${subline.length} characters (recommended ${limits.subline})`);
        const both = `${headline} ${subline}`;
        if (/!/.test(both)) warnings.push(`${label}: no exclamation marks (copy rule 8)`);
        for (const claim of forbidden) {
          if (both.toLocaleLowerCase().includes(claim.toLocaleLowerCase())) errors.push(`${label}: uses the forbidden claim "${claim}"`);
        }
      }
    }
    for (const slot of briefSlots) {
      if (!seen.has(slot.input)) warnings.push(`${locale}: no headline for slot ${slot.slot} (${slot.input})`);
    }
  }
  for (const locale of locales) {
    if (!(locale in result.locales) && (brief.screenshots?.[locale] ?? []).length > 0) warnings.push(`${locale}: no headlines for this language`);
  }
}

for (const warning of warnings) console.log(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);
if (errors.length > 0) {
  console.error(`${errors.length} error(s): fix them and run the check again.`);
  process.exit(1);
}
console.log(`OK: headlines.json is valid${warnings.length > 0 ? ` (${warnings.length} warning(s))` : ''}.`);
