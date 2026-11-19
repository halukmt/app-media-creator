import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { StoreTextField } from '../../src/core/specs/index.js';

type Texts = Partial<Record<string, Partial<Record<StoreTextField, string>>>>;

/** A complete, valid App Store and Google Play listing in German and Turkish (Turkish letters in the keywords). */
export function storeListingTexts(): Texts {
  return {
    'de-DE': {
      'apple-name': 'Teamfinder',
      'apple-subtitle': 'Faire Teams in Sekunden',
      'apple-description': 'Teile Spieler nach Stärke in zwei faire Teams.\n\nOhne Konto.',
      'apple-keywords': 'fußball,mannschaft,auslosen,kicker',
      'google-title': 'Teamfinder',
      'google-short-description': 'Faire Teams für dein Spiel in Sekunden',
      'google-full-description': 'Teile Spieler nach Stärke in zwei faire Teams.',
    },
    'tr-TR': {
      'apple-name': 'Teamfinder',
      'apple-description': 'Oyuncuları güce göre iki dengeli takıma ayır.',
      'apple-keywords': 'futbol,takım,kura,halı saha',
    },
  };
}

/** A store texts document as the API receives it. */
export function storeTextsDocument(texts: Texts = storeListingTexts(), revision = 0): { version: 1; revision: number; texts: Texts } {
  return { version: 1, revision, texts };
}

/** Writes AI results into a job folder as `store-texts/<locale>/<field>.md`. */
export function writeStoreTextResults(folder: string, texts: Texts): void {
  for (const [locale, fields] of Object.entries(texts)) {
    mkdirSync(path.join(folder, 'store-texts', locale), { recursive: true });
    for (const [field, text] of Object.entries(fields ?? {})) writeFileSync(path.join(folder, 'store-texts', locale, `${field}.md`), text);
  }
}
